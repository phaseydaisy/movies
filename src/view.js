import { getJson, poster, backdrop } from "./api.js";
import { getLocalItem, getSimilarLocal } from "./catalog.js";

const params = new URLSearchParams(location.search);
const id = params.get("id");
const type = params.get("type") || "movie";
const source = params.get("source") || "tmdb";

const backdropEl = document.getElementById("backdrop");
const posterEl = document.getElementById("poster");
const titleEl = document.getElementById("title");
const metaEl = document.getElementById("meta");
const overviewEl = document.getElementById("overview");
const genresEl = document.getElementById("genres");
const similarEl = document.getElementById("similar");
const watchBtn = document.getElementById("watchBtn");

function card(item) {
  const el = document.createElement("article");
  el.className = "media-card";
  const title = item.title || item.name || "Untitled";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4) || "N/A";
  const mediaType = item.media_type || type;
  el.innerHTML = `
    <img class="media-poster" src="${poster(item.poster_path)}" alt="${title}" />
    <div class="media-content">
      <h4 class="media-title">${title}</h4>
      <div class="media-meta"><span>${item.vote_average ? item.vote_average.toFixed(1) : "N/A"}</span><span>${year}</span></div>
    </div>
  `;
  el.addEventListener("click", () => {
    location.href = `view.html?id=${item.id}&type=${mediaType}&source=${source}`;
  });
  return el;
}

async function init() {
  if (!id) return;

  let item;
  let similar;
  if (source === "local") {
    item = getLocalItem(id, type);
    similar = { results: item ? getSimilarLocal(item) : [] };
  } else {
    [item, similar] = await Promise.all([
      getJson(`/${type}/${id}`),
      getJson(`/${type}/${id}/similar`),
    ]);
  }
  if (!item) {
    overviewEl.textContent = "Content not found.";
    return;
  }

  const title = item.title || item.name || "Untitled";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4) || "N/A";

  backdropEl.src = backdrop(item.backdrop_path);
  posterEl.src = poster(item.poster_path);
  titleEl.textContent = title;
  metaEl.textContent = `${year} • ${item.vote_average ? item.vote_average.toFixed(1) : "N/A"}`;
  overviewEl.textContent = item.overview || "No overview available.";

  genresEl.innerHTML = "";
  (item.genres || []).forEach((genre) => {
    const tag = document.createElement("span");
    tag.className = "px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-sm";
    tag.textContent = genre.name;
    genresEl.append(tag);
  });

  similarEl.innerHTML = "";
  (similar.results || []).slice(0, 15).forEach((entry) => similarEl.append(card(entry)));

  watchBtn.onclick = () => {
    location.href = `watch.html?id=${id}&type=${type}&source=${source}`;
  };
}

init().catch((error) => {
  console.error(error);
  overviewEl.textContent = error.message || "Failed to load details.";
});
