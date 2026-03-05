import { getJson, poster, backdrop, fetchTrailerKey } from "./api.js";
import { TMDB_API_KEY, AUTH_API_BASE_URL } from "./config.js";
import { MOVIES, SHOWS, TEEN, ALL, getLocalItem } from "./catalog.js";

const state = {
  hero: null,
  detail: null,
  detailType: "movie",
  searchFilter: "multi",
  searchQuery: "",
  searchPage: 1,
  mode: TMDB_API_KEY && !TMDB_API_KEY.includes("PASTE_YOUR") ? "tmdb" : "local",
  session: null,
  history: [],
};

const AUTH_SESSION_KEY = "cinenest:session";
const RESUME_STORAGE_KEY = "cinenest:playback-progress";

const elements = {
  heroBackdrop: document.getElementById("heroBackdrop"),
  heroTitle: document.getElementById("heroTitle"),
  heroOverview: document.getElementById("heroOverview"),
  heroPlay: document.getElementById("heroPlay"),
  heroInfo: document.getElementById("heroInfo"),
  moviesRow: document.getElementById("moviesRow"),
  tvRow: document.getElementById("tvRow"),
  animeRow: document.getElementById("animeRow"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  searchPageOverlay: document.getElementById("searchPageOverlay"),
  searchPageFrame: document.getElementById("searchPageFrame"),
  closeSearchPageOverlay: document.getElementById("closeSearchPageOverlay"),
  signUpBtn: document.getElementById("signUpBtn"),
  signInBtn: document.getElementById("signInBtn"),
  accountPill: document.getElementById("accountPill"),
  accountName: document.getElementById("accountName"),
  accountSettingsBtn: document.getElementById("accountSettingsBtn"),
  accountDropdown: document.getElementById("accountDropdown"),
  signOutBtn: document.getElementById("signOutBtn"),
  detailModal: document.getElementById("detailModal"),
  closeDetail: document.getElementById("closeDetail"),
  detailBackdrop: document.getElementById("detailBackdrop"),
  detailTitle: document.getElementById("detailTitle"),
  detailMeta: document.getElementById("detailMeta"),
  detailOverview: document.getElementById("detailOverview"),
  trailerWrap: document.getElementById("trailerWrap"),
  trailerBtn: document.getElementById("trailerBtn"),
  watchBtn: document.getElementById("watchBtn"),
  toast: document.getElementById("toast"),
  navHome: document.getElementById("navHome"),
  navMovies: document.getElementById("navMovies"),
  navTv: document.getElementById("navTv"),
  navList: document.getElementById("navList"),
  continueSection: document.getElementById("continueSection"),
  continueRow: document.getElementById("continueRow"),
  moviesSection: document.getElementById("moviesSection"),
  tvSection: document.getElementById("tvSection"),
  myListModal: document.getElementById("myListModal"),
  closeMyList: document.getElementById("closeMyList"),
  myListResults: document.getElementById("myListResults"),
};

let searchDebounceTimer = null;

function getAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function setAuthSession(session) {
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function getApiBase() {
  return String(AUTH_API_BASE_URL || "").trim().replace(/\/$/, "");
}

async function callAuthApi(path, payload) {
  const base = getApiBase();
  if (!base || base.includes("<your-subdomain>")) {
    throw new Error("Set AUTH_API_BASE_URL in src/config.js");
  }

  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  const data = await response.json().catch(() => ({ ok: false, message: "Invalid server response" }));
  if (!response.ok) return { ...data, ok: false };
  return data;
}

function syncAuthUi() {
  state.session = getAuthSession();
  const signedIn = !!state.session;

  if (elements.signUpBtn) elements.signUpBtn.classList.toggle("hidden", signedIn);
  if (elements.signInBtn) elements.signInBtn.classList.toggle("hidden", signedIn);
  if (elements.accountPill) elements.accountPill.classList.toggle("hidden", !signedIn);
  if (!signedIn && elements.accountDropdown) elements.accountDropdown.classList.add("hidden");
  if (signedIn && elements.accountName) {
    elements.accountName.textContent = state.session.name || state.session.email || "Account";
  }
}

function wireAuth() {
  syncAuthUi();

  elements.signUpBtn.addEventListener("click", () => {
    location.href = "signup/";
  });

  elements.signInBtn.addEventListener("click", () => {
    location.href = "signin/";
  });

  if (elements.accountSettingsBtn && elements.accountDropdown) {
    elements.accountSettingsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      elements.accountDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (event) => {
      if (elements.accountPill && !elements.accountPill.contains(event.target)) {
        elements.accountDropdown.classList.add("hidden");
      }
    });
  }

  elements.signOutBtn.addEventListener("click", () => {
    if (elements.accountDropdown) elements.accountDropdown.classList.add("hidden");
    setAuthSession(null);
    state.history = [];
    renderContinueWatching();
    syncAuthUi();
    toast("Signed out");
  });
}

function openSearchPage(rawQuery = "") {
  const query = String(rawQuery || "").trim();
  const url = query ? `pages/search.html?q=${encodeURIComponent(query)}` : "pages/search.html";

  if (!elements.searchPageOverlay || !elements.searchPageFrame) {
    location.href = url;
    return;
  }

  elements.searchPageFrame.src = url;
  elements.searchPageOverlay.classList.remove("hidden");
  requestAnimationFrame(() => elements.searchPageOverlay.classList.add("is-open"));
}

function closeSearchPage() {
  if (!elements.searchPageOverlay) return;
  elements.searchPageOverlay.classList.remove("is-open");
  setTimeout(() => {
    elements.searchPageOverlay.classList.add("hidden");
    if (elements.searchPageFrame) {
      elements.searchPageFrame.src = "about:blank";
    }
  }, 280);
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  setTimeout(() => elements.toast.classList.add("hidden"), 2200);
}

function formatTitle(item) {
  return item.title || item.name || "Untitled";
}

function formatYear(item) {
  const date = item.release_date || item.first_air_date;
  return date ? new Date(date).getFullYear() : "N/A";
}

function findLocalByTmdbId(id, type) {
  return ALL.find((item) => String(item.tmdb_id) === String(id) && item.media_type === type) || null;
}

function getSessionEmail() {
  return String(state.session?.email || "").trim().toLowerCase();
}

function readProgressMap() {
  try {
    return JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getProgressKeyForEntry(entry) {
  const source = String(entry?.source || "tmdb");
  const type = String(entry?.type || "movie");
  const id = String(entry?.id || "");

  if (!id) return "";
  if (type !== "tv") return `${source}:${type}:${id}`;

  const season = Number(entry?.season || 0);
  const episode = Number(entry?.episode || 0);
  if (season > 0 && episode > 0) {
    return `${source}:${type}:${id}:s${season}:e${episode}`;
  }

  return `${source}:${type}:${id}`;
}

function buildWatchHref(entry) {
  const source = entry.source || "tmdb";
  const base = `pages/watch.html?id=${entry.id}&type=${entry.type}&source=${source}`;

  if (entry.type !== "tv") return base;

  const season = Number(entry?.season || 0);
  const episode = Number(entry?.episode || 0);
  if (season > 0 && episode > 0) {
    return `${base}&season=${season}&episode=${episode}`;
  }

  return base;
}

function formatHistoryTime(value) {
  const date = new Date(Number(value || 0));
  if (Number.isNaN(date.getTime())) return "Recently watched";
  return `Watched ${date.toLocaleString()}`;
}

function formatHistoryType(entry) {
  const type = String(entry?.type || "movie").toUpperCase();
  if (entry?.type !== "tv") return type;

  const season = Number(entry?.season || 0);
  const episode = Number(entry?.episode || 0);
  if (season > 0 && episode > 0) {
    return `${type} • S${season}:E${episode}`;
  }
  return type;
}

async function loadWatchHistory() {
  const email = getSessionEmail();
  if (!email) {
    state.history = [];
    return [];
  }

  const data = await callAuthApi("/history/list", { email }).catch((error) => ({ ok: false, message: error.message }));
  if (!data.ok) {
    state.history = [];
    renderContinueWatching();
    return [];
  }

  state.history = Array.isArray(data.history) ? data.history : [];
  renderContinueWatching();
  return state.history;
}

function renderMyList() {
  const list = state.history;
  elements.myListResults.innerHTML = "";

  if (!getSessionEmail()) {
    elements.myListResults.innerHTML = '<p class="text-gray-400">Sign in to see your watch history.</p>';
    return;
  }

  if (!list.length) {
    elements.myListResults.innerHTML = '<p class="text-gray-400">your list is empty</p>';
    return;
  }

  list.forEach((entry) => {
    const card = document.createElement("button");
    card.className = "history-card";
    const title = entry.title || "Untitled";
    const rating = Number(entry.vote_average || 0);
    const year = formatYear(entry);
    card.innerHTML = `
      <img class="history-card-poster" src="${poster(entry.poster_path)}" alt="${title}" />
      <div class="history-card-body">
        <div class="history-card-top">
          <p class="history-card-title line-clamp-1">${title}</p>
          <span class="history-card-type">${formatHistoryType(entry)}</span>
        </div>
        <p class="history-card-meta">${formatHistoryTime(entry.watchedAt)}</p>
        <div class="history-card-foot">
          <span><i class="fa-solid fa-star text-yellow-400"></i> ${rating ? rating.toFixed(1) : "N/A"}</span>
          <span>${year}</span>
          <span class="history-card-open">Resume</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      elements.myListModal.classList.add("hidden");
      location.href = buildWatchHref(entry);
    });
    elements.myListResults.append(card);
  });
}

function renderContinueWatching() {
  if (!elements.continueSection || !elements.continueRow) return;

  const progressMap = readProgressMap();
  const items = state.history
    .map((entry) => {
      const key = getProgressKeyForEntry(entry);
      return {
        entry,
        progressSeconds: Number(progressMap[key] || 0),
      };
    })
    .filter((item) => item.progressSeconds > 0)
    .slice(0, 20);

  elements.continueRow.innerHTML = "";

  if (!items.length) {
    elements.continueSection.classList.add("hidden");
    return;
  }

  elements.continueSection.classList.remove("hidden");

  items.forEach(({ entry, progressSeconds }) => {
    const card = document.createElement("article");
    card.className = "media-card";
    card.innerHTML = `
      <img class="media-poster" src="${poster(entry.poster_path)}" alt="${entry.title || "Untitled"}" />
      <div class="media-content">
        <h4 class="media-title">${entry.title || "Untitled"}</h4>
        <div class="media-meta">
          <span>${formatHistoryType(entry)}</span>
          <span>${Math.floor(progressSeconds / 60)}m watched</span>
        </div>
        <div class="media-actions">
          <button class="btn-play" data-action="resume">Resume</button>
          <button class="btn-info" data-action="info">Info</button>
        </div>
      </div>
    `;

    card.querySelector('[data-action="resume"]').addEventListener("click", () => {
      location.href = buildWatchHref(entry);
    });

    card.querySelector('[data-action="info"]').addEventListener("click", () => {
      openDetail(entry.id, entry.type, entry.source || "tmdb");
    });

    elements.continueRow.append(card);
  });
}

function createCard(item, type = "movie", source = "tmdb") {
  const card = document.createElement("article");
  card.className = "media-card";
  card.innerHTML = `
    <img class="media-poster" src="${poster(item.poster_path)}" alt="${formatTitle(item)}" />
    <div class="media-content">
      <h4 class="media-title">${formatTitle(item)}</h4>
      <div class="media-meta">
        <span><i class="fa-solid fa-star text-yellow-400"></i> ${item.vote_average ? item.vote_average.toFixed(1) : "N/A"}</span>
        <span>${formatYear(item)}</span>
      </div>
      <div class="media-actions">
        <button class="btn-play" data-action="play">Play</button>
        <button class="btn-info" data-action="info">Info</button>
      </div>
    </div>
  `;

  card.querySelector('[data-action="play"]').addEventListener("click", () => {
    location.href = `pages/watch.html?id=${item.id}&type=${type}&source=${source}`;
  });

  card.querySelector('[data-action="info"]').addEventListener("click", () => {
    openDetail(item.id, type, source);
  });

  return card;
}

async function loadHero() {
  if (state.mode === "local") {
    const top = MOVIES.slice(0, 5);
    const chosen = top[Math.floor(Math.random() * Math.max(top.length, 1))];
    if (!chosen) return;

    state.hero = chosen;
    elements.heroBackdrop.style.backgroundImage = `url(${backdrop(chosen.backdrop_path)})`;
    elements.heroTitle.textContent = formatTitle(chosen);
    elements.heroOverview.textContent = chosen.overview || "No overview available.";

    elements.heroPlay.onclick = () => (location.href = `pages/watch.html?id=${chosen.id}&type=movie&source=local`);
    elements.heroInfo.onclick = () => openDetail(chosen.id, "movie", "local");
    return;
  }

  let data;
  try {
    data = await getJson("/trending/movie/day");
  } catch {
    state.mode = "local";
    await loadHero();
    return;
  }
  const top = data.results?.slice(0, 5) || [];
  const chosen = top[Math.floor(Math.random() * Math.max(top.length, 1))];
  if (!chosen) return;

  state.hero = chosen;
  elements.heroBackdrop.style.backgroundImage = `url(${backdrop(chosen.backdrop_path)})`;
  elements.heroTitle.textContent = formatTitle(chosen);
  elements.heroOverview.textContent = chosen.overview || "No overview available.";

  elements.heroPlay.onclick = () => (location.href = `pages/watch.html?id=${chosen.id}&type=movie`);
  elements.heroInfo.onclick = () => openDetail(chosen.id, "movie");
}

async function loadRows() {
  if (state.mode === "local") {
    elements.moviesRow.innerHTML = "";
    elements.tvRow.innerHTML = "";
    elements.animeRow.innerHTML = "";

    MOVIES.forEach((item) => elements.moviesRow.append(createCard(item, "movie", "local")));
    SHOWS.forEach((item) => elements.tvRow.append(createCard(item, "tv", "local")));
    TEEN.forEach((item) => elements.animeRow.append(createCard(item, "tv", "local")));
    return;
  }

  let movies;
  let tv;
  let sixteen;
  try {
    [movies, tv, sixteen] = await Promise.all([
      getJson("/trending/movie/week"),
      getJson("/tv/popular"),
      getJson("/discover/tv?with_genres=16&sort_by=popularity.desc"),
    ]);
  } catch {
    state.mode = "local";
    await loadRows();
    return;
  }

  elements.moviesRow.innerHTML = "";
  elements.tvRow.innerHTML = "";
  elements.animeRow.innerHTML = "";

  (movies.results || []).slice(0, 20).forEach((item) => elements.moviesRow.append(createCard(item, "movie", "tmdb")));
  (tv.results || []).slice(0, 20).forEach((item) => elements.tvRow.append(createCard(item, "tv", "tmdb")));
  (sixteen.results || []).slice(0, 20).forEach((item) => elements.animeRow.append(createCard(item, "tv", "tmdb")));
}

async function openDetail(id, type = "movie", source = "tmdb") {
  state.detailType = type;

  try {
    if (source === "local") {
      state.detail = getLocalItem(id, type);
    } else {
      state.detail = await getJson(`/${type}/${id}`);
    }
  } catch {
    state.detail = findLocalByTmdbId(id, type);
    source = "local";
  }
  if (!state.detail) {
    toast("Could not load details for this title.");
    return;
  }

  elements.detailBackdrop.src = backdrop(state.detail.backdrop_path);
  elements.detailTitle.textContent = formatTitle(state.detail);
  elements.detailMeta.textContent = `${formatYear(state.detail)} • ${state.detail.vote_average ? state.detail.vote_average.toFixed(1) : "N/A"} • ${state.detail.runtime || state.detail.number_of_seasons || "N/A"}`;
  elements.detailOverview.textContent = state.detail.overview || "No overview available.";
  elements.trailerWrap.classList.add("hidden");
  elements.trailerWrap.innerHTML = "";
  elements.detailModal.classList.remove("hidden");

  elements.watchBtn.onclick = () => {
    location.href = `pages/watch.html?id=${id}&type=${type}&source=${source}`;
  };

  elements.trailerBtn.onclick = async () => {
    let key;
    try {
      key = source === "local" ? state.detail.trailer_key : await fetchTrailerKey(id, type);
    } catch {
      key = state.detail.trailer_key;
    }
    if (!key) {
      toast("Trailer not available");
      return;
    }
    elements.trailerWrap.classList.remove("hidden");
    elements.trailerWrap.innerHTML = `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${key}?autoplay=1&mute=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  };
}

function runSearchFromInput() {
  state.searchQuery = elements.searchInput.value;
  state.searchPage = 1;
  openSearchPage(state.searchQuery);
}

function wireSearch() {
  elements.searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    runSearchFromInput();
  });

  elements.searchBtn.addEventListener("click", () => {
    runSearchFromInput();
  });

  elements.searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      state.searchQuery = elements.searchInput.value;
    }, 220);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (elements.searchPageOverlay && !elements.searchPageOverlay.classList.contains("hidden")) {
        closeSearchPage();
        return;
      }
      elements.detailModal.classList.add("hidden");
    }
  });
}

function wireSearchOverlay() {
  if (!elements.searchPageOverlay || !elements.searchPageFrame || !elements.closeSearchPageOverlay) return;

  elements.closeSearchPageOverlay.addEventListener("click", () => {
    closeSearchPage();
  });

  elements.searchPageOverlay.addEventListener("click", (event) => {
    if (event.target === elements.searchPageOverlay) {
      closeSearchPage();
    }
  });

  window.addEventListener("message", (event) => {
    if (event.data?.type === "cinenest-close-search-overlay") {
      closeSearchPage();
    }
  });
}

function wireDetailClose() {
  elements.closeDetail.addEventListener("click", () => {
    elements.detailModal.classList.add("hidden");
    elements.trailerWrap.innerHTML = "";
  });
}

function wireComingSoon() {
  document.querySelectorAll("[data-coming]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      toast(`${item.dataset.coming} is coming soon`);
    });
  });
}

function wireNav() {
  const offset = 90;
  const scrollToSection = (section) => {
    if (!section) return;
    const y = section.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  elements.navHome.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  elements.navMovies.addEventListener("click", (event) => {
    event.preventDefault();
    scrollToSection(elements.moviesSection);
  });

  elements.navTv.addEventListener("click", (event) => {
    event.preventDefault();
    scrollToSection(elements.tvSection);
  });

  elements.navList.addEventListener("click", (event) => {
    event.preventDefault();
    if (elements.accountDropdown) elements.accountDropdown.classList.add("hidden");
    loadWatchHistory()
      .finally(() => {
        renderMyList();
        elements.myListModal.classList.remove("hidden");
      });
  });

  elements.closeMyList.addEventListener("click", () => {
    elements.myListModal.classList.add("hidden");
  });

  elements.myListModal.addEventListener("click", (event) => {
    if (event.target === elements.myListModal) {
      elements.myListModal.classList.add("hidden");
    }
  });
}

function wireQolControls() {
  document.querySelectorAll("[data-qol-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.qolScroll;
      if (target === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (target === "movies") {
        elements.navMovies.click();
        return;
      }
      if (target === "tv") {
        elements.navTv.click();
      }
    });
  });

  document.querySelectorAll("[data-qol-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.qolAction;
      if (action === "search") {
        openSearchPage(elements.searchInput.value);
      }
      if (action === "list") {
        elements.navList.click();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== elements.searchInput) {
      event.preventDefault();
      openSearchPage(elements.searchInput.value);
    }
  });
}

async function init() {
  try {
    wireSearch();
    wireSearchOverlay();
    wireAuth();
    wireNav();
    wireQolControls();
    wireDetailClose();
    wireComingSoon();
    await Promise.all([loadHero(), loadRows()]);
    await loadWatchHistory();
  } catch (error) {
    toast(error.message || "Failed to initialize app");
    console.error(error);
  }
}

init();
