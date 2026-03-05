import { getJson, poster } from "./api.js";
import { TMDB_API_KEY } from "./config.js";
import { searchLocal } from "./catalog.js";

const params = new URLSearchParams(location.search);

const state = {
  query: params.get("q") || "",
  filter: params.get("filter") || "multi",
  page: Number(params.get("page") || 1),
  totalPages: 1,
  mode: TMDB_API_KEY && !TMDB_API_KEY.includes("PASTE_YOUR") ? "tmdb" : "local",
};

const elements = {
  backHome: document.getElementById("backHome"),
  searchCloseX: document.getElementById("searchCloseX"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  searchQueryDisplay: document.getElementById("searchQueryDisplay"),
  searchFloatingQuery: document.getElementById("searchFloatingQuery"),
  searchResults: document.getElementById("searchResults"),
  resultCount: document.getElementById("resultCount"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  toast: document.getElementById("toast"),
};

let debounceTimer = null;

function isEmbedded() {
  return window.self !== window.top;
}

function closeSearchView() {
  if (isEmbedded()) {
    window.parent.postMessage({ type: "cinenest-close-search-overlay" }, "*");
    return;
  }
  location.href = "/";
}

function goHomeInsideEmbed() {
  location.href = "/";
}

function navigate(url) {
  if (isEmbedded()) {
    window.top.location.href = url;
    return;
  }
  location.href = url;
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  setTimeout(() => elements.toast.classList.add("hidden"), 2000);
}

function formatTitle(item) {
  return item.title || item.name || "Untitled";
}

function updateUrl() {
  const search = new URLSearchParams();
  if (state.query.trim()) search.set("q", state.query.trim());
  if (state.filter !== "multi") search.set("filter", state.filter);
  if (state.page > 1) search.set("page", String(state.page));
  history.replaceState({}, "", `${search.toString() ? `?${search.toString()}` : ""}`);
}

function updateQueryUI() {
  const q = state.query.trim();
  const shown = q || "—";
  elements.searchQueryDisplay.textContent = `Query: ${shown}`;
  elements.searchFloatingQuery.textContent = `Results for \"${shown}\"`;
  elements.searchInput.value = state.query;
}

function syncPager() {
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= state.totalPages;
  elements.prevPage.classList.toggle("opacity-50", elements.prevPage.disabled);
  elements.nextPage.classList.toggle("opacity-50", elements.nextPage.disabled);
}

async function runSearch() {
  updateQueryUI();
  updateUrl();

  const hasQuery = !!state.query.trim();
  if (!hasQuery) {
    state.totalPages = 1;
    elements.searchResults.innerHTML = '<p class="col-span-full text-gray-400">Type a query and press Enter (or click Search).</p>';
    elements.resultCount.textContent = "0 results • Page 1 of 1";
    syncPager();
    return;
  }

  let results = [];

  if (state.mode === "local") {
    const data = searchLocal(state.query, state.filter, state.page);
    results = data.results || [];
    state.totalPages = data.total_pages || 1;
  } else {
    try {
      const query = encodeURIComponent(state.query.trim());
      const res = await getJson(`/search/${state.filter}?query=${query}&page=${state.page}&include_adult=false`);
      results = (res.results || []).filter((item) => (state.filter === "multi" ? item.media_type !== "person" || item.profile_path : true));
      state.totalPages = res.total_pages || 1;
    } catch {
      const fallback = searchLocal(state.query, state.filter, state.page);
      results = fallback.results || [];
      state.totalPages = fallback.total_pages || 1;
      toast("Using local search fallback");
    }
  }

  elements.searchResults.innerHTML = "";
  elements.resultCount.textContent = `${results.length} results • Page ${state.page} of ${state.totalPages}`;

  if (!results.length) {
    elements.searchResults.innerHTML = hasQuery
      ? '<p class="col-span-full text-gray-400">No results found.</p>'
      : '<p class="col-span-full text-gray-400">No browse results available right now.</p>';
    state.totalPages = 1;
    syncPager();
    return;
  }

  results.forEach((item) => {
    const type = item.media_type || state.filter;
    const title = formatTitle(item);
    const image = type === "person" ? poster(item.profile_path) : poster(item.poster_path);
    const card = document.createElement("button");
    card.className = "search-card text-left";
    card.innerHTML = `
      <img src="${image}" alt="${title}" />
      <div class="text">
        <p class="font-semibold line-clamp-2">${title}</p>
        <p class="text-xs text-gray-400 mt-1">${type.toUpperCase()}</p>
      </div>
    `;

    card.addEventListener("click", () => {
      if (type === "person") {
        toast("Person details are not implemented in this clone yet.");
        return;
      }
      const source = state.mode === "local" ? "local" : "tmdb";
      navigate(`view.html?id=${item.id}&type=${type}&source=${source}`);
    });

    elements.searchResults.append(card);
  });

  syncPager();
}

function wire() {
  if (isEmbedded() && elements.backHome) {
    elements.backHome.classList.add("hidden");
  }

  if (elements.searchCloseX) {
    elements.searchCloseX.addEventListener("click", () => {
      goHomeInsideEmbed();
    });
  }

  elements.backHome.addEventListener("click", () => {
    closeSearchView();
  });

  elements.searchInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    state.query = elements.searchInput.value;
    state.page = 1;
    await runSearch();
  });

  elements.searchBtn.addEventListener("click", async () => {
    state.query = elements.searchInput.value;
    state.page = 1;
    await runSearch();
  });

  document.querySelectorAll(".filter-btn").forEach((button) => {
    if (button.dataset.filter === state.filter) {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
    }

    button.addEventListener("click", async () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      state.filter = button.dataset.filter;
      state.page = 1;
      await runSearch();
    });
  });

  elements.prevPage.addEventListener("click", async () => {
    if (state.page <= 1) return;
    state.page -= 1;
    await runSearch();
  });

  elements.nextPage.addEventListener("click", async () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    await runSearch();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearchView();
    }
  });
}

async function init() {
  wire();
  updateQueryUI();
  await runSearch();
  elements.searchInput.focus();
}

init().catch((error) => {
  console.error(error);
  toast(error.message || "Search failed.");
});
