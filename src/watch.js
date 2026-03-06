import { getJson, poster, fetchTrailerKey } from "./api.js";
import { getLocalItem } from "./catalog.js";
import { WATCH_SERVERS } from "./providers.js";
import { AUTH_API_BASE_URL } from "./config.js";

const params = new URLSearchParams(location.search);
const id = params.get("id");
const type = params.get("type") || "movie";
const source = params.get("source") || "tmdb";
const initialSeasonParam = Number(params.get("season") || 0);
const initialEpisodeParam = Number(params.get("episode") || 0);
const initialStartParam = Number(params.get("start") || params.get("time") || params.get("t") || 0);

const playerWrap = document.getElementById("playerWrap");
const playerContent = document.getElementById("playerContent");
const playerNextOverlay = document.getElementById("playerNextOverlay");
const posterImg = document.getElementById("poster");
const titleEl = document.getElementById("title");
const metaEl = document.getElementById("meta");
const overviewEl = document.getElementById("overview");
const detailsBtn = document.getElementById("detailsBtn");
const serverList = document.getElementById("serverList");
const serverHint = document.getElementById("serverHint");
const episodeControls = document.getElementById("episodeControls");
const seasonSelect = document.getElementById("seasonSelect");
const episodeSelect = document.getElementById("episodeSelect");
const episodeHint = document.getElementById("episodeHint");
const nextBtn = document.getElementById("nextBtn");

let currentTrailerKey = null;
let currentItem = null;
let activeServerKey = "trailer";
let currentSeason = 1;
let currentEpisode = 1;
let tmdbTvId = null;
let episodeCache = new Map();
let overlayRevealTimer = null;
let playbackStartedAtMs = 0;
let playbackBaselineSec = 0;
let progressSaveTimer = null;
let pendingResumeSec = null;
let lastHistorySyncAtMs = 0;

const SERVERS = WATCH_SERVERS;
const RESUME_STORAGE_KEY = "movies:playback-progress";
const AUTH_SESSION_KEY = "movies:session";

function getApiBase() {
  return String(AUTH_API_BASE_URL || "").trim().replace(/\/$/, "");
}

function getAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
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

  const data = await response.json().catch(() => ({ ok: false }));
  if (!response.ok) return { ...data, ok: false };
  return data;
}

function getHistoryEntry(resumeSecondsOverride = null) {
  if (!currentItem) return null;
  const resumeSeconds = resumeSecondsOverride === null || resumeSecondsOverride === undefined
    ? Math.max(0, Math.floor(getEstimatedProgressSeconds()))
    : Math.max(0, Math.floor(Number(resumeSecondsOverride) || 0));

  const base = {
    id: String(id || "").trim(),
    type,
    source,
    title: currentItem.title || currentItem.name || "Untitled",
    poster_path: currentItem.poster_path || null,
    vote_average: Number(currentItem.vote_average || 0) || 0,
    release_date: currentItem.release_date || null,
    first_air_date: currentItem.first_air_date || null,
    resumeSeconds,
  };

  if (type === "tv") {
    base.season = currentSeason;
    base.episode = currentEpisode;
  }
  return base;
}

function recordHistory() {
  const session = getAuthSession();
  const email = String(session?.email || "").trim().toLowerCase();
  const entry = getHistoryEntry();

  if (!email || !entry) return;

  callAuthApi("/history/upsert", {
    email,
    entry,
  }).catch(() => {});
}

function syncHistoryProgress(force = false) {
  const now = Date.now();
  if (!force && now - lastHistorySyncAtMs < 15000) return;
  lastHistorySyncAtMs = now;

  const session = getAuthSession();
  const email = String(session?.email || "").trim().toLowerCase();
  if (!email) return;

  const entry = getHistoryEntry(getEstimatedProgressSeconds());
  if (!entry) return;

  callAuthApi("/history/upsert", {
    email,
    entry,
  }).catch(() => {});
}

function getProgressContextKey() {
  const sourceKey = source || "tmdb";
  if (type === "tv") {
    return `${sourceKey}:${type}:${id}:s${currentSeason}:e${currentEpisode}`;
  }
  return `${sourceKey}:${type}:${id}`;
}

function readProgressMap() {
  try {
    return JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeProgressMap(map) {
  localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(map));
}

function getSavedProgressSeconds() {
  const map = readProgressMap();
  return Number(map[getProgressContextKey()] || 0);
}

function saveProgressSeconds(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const map = readProgressMap();
  map[getProgressContextKey()] = safeSeconds;
  writeProgressMap(map);
}

function getEstimatedProgressSeconds() {
  if (!playbackStartedAtMs) return playbackBaselineSec;
  return playbackBaselineSec + Math.max(0, Math.floor((Date.now() - playbackStartedAtMs) / 1000));
}

function captureResumePoint() {
  const current = Math.max(0, Math.floor(getEstimatedProgressSeconds()));
  saveProgressSeconds(current);
  pendingResumeSec = current;
  return current;
}

function getResumeStartSeconds() {
  if (pendingResumeSec !== null && pendingResumeSec !== undefined) {
    return Math.max(0, Math.floor(Number(pendingResumeSec) || 0));
  }
  const estimated = Math.max(0, Math.floor(getEstimatedProgressSeconds()));
  const saved = Math.max(0, Math.floor(getSavedProgressSeconds()));
  return Math.max(saved, estimated);
}

function stopProgressTracking() {
  if (progressSaveTimer) {
    clearInterval(progressSaveTimer);
    progressSaveTimer = null;
  }
  if (playbackStartedAtMs) {
    saveProgressSeconds(getEstimatedProgressSeconds());
    syncHistoryProgress(true);
  }
}

function startProgressTracking(startSeconds) {
  stopProgressTracking();
  playbackBaselineSec = Math.max(0, Math.floor(Number(startSeconds) || 0));
  playbackStartedAtMs = Date.now();
  progressSaveTimer = setInterval(() => {
    saveProgressSeconds(getEstimatedProgressSeconds());
    syncHistoryProgress(false);
  }, 5000);
}

function clearOverlayRevealTimer() {
  if (overlayRevealTimer) {
    clearTimeout(overlayRevealTimer);
    overlayRevealTimer = null;
  }
}

function hidePlayerOverlayButton() {
  if (!playerNextOverlay) return;
  playerNextOverlay.classList.add("hidden");
}

function getCurrentRuntimeMinutes() {
  if (!currentItem) return 0;

  if (type !== "tv") {
    const movieRuntime = Number(currentItem.runtime);
    return Number.isFinite(movieRuntime) && movieRuntime > 0 ? movieRuntime : 110;
  }

  const episodes = episodeCache.get(currentSeason) || [];
  const currentEpisodeData = episodes.find((episode) => Number(episode.episode_number) === Number(currentEpisode));
  const runtimeFromEpisode = Number(currentEpisodeData?.runtime || currentEpisodeData?.episode_run_time);
  if (Number.isFinite(runtimeFromEpisode) && runtimeFromEpisode > 0) return runtimeFromEpisode;

  const runtimeFromShow = Array.isArray(currentItem.episode_run_time)
    ? Number(currentItem.episode_run_time[0])
    : Number(currentItem.episode_run_time);
  if (Number.isFinite(runtimeFromShow) && runtimeFromShow > 0) return runtimeFromShow;

  const runtimeFromLastEpisode = Number(currentItem.last_episode_to_air?.runtime);
  if (Number.isFinite(runtimeFromLastEpisode) && runtimeFromLastEpisode > 0) return runtimeFromLastEpisode;

  return 45;
}

function schedulePlayerOverlayReveal() {
  if (!playerNextOverlay) return;

  clearOverlayRevealTimer();
  hidePlayerOverlayButton();

  const runtimeMinutes = getCurrentRuntimeMinutes();
  const revealDelayMs = Math.max(Math.round((runtimeMinutes * 60 - 15) * 1000), 3000);

  overlayRevealTimer = setTimeout(() => {
    playerNextOverlay.classList.remove("hidden");
  }, revealDelayMs);
}

function addResumeParams(url, startSeconds = 0) {
  const safeStart = Math.max(0, Math.floor(Number(startSeconds) || 0));
  if (!safeStart) return url;

  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set("start", String(safeStart));
    parsed.searchParams.set("time", String(safeStart));
    parsed.searchParams.set("t", String(safeStart));
    return parsed.toString();
  } catch {
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}start=${safeStart}&time=${safeStart}&t=${safeStart}`;
  }
}

function renderPlayerFromUrl(url, startSeconds = 0) {
  const resumedUrl = addResumeParams(url, startSeconds);
  playerContent.innerHTML = `<iframe class="w-full h-full" src="${resumedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="no-referrer"></iframe>`;
  startProgressTracking(startSeconds);
  pendingResumeSec = null;
  schedulePlayerOverlayReveal();
}

function addEpisodeParams(url) {
  if (type !== "tv") return url;
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set("season", String(currentSeason));
    parsed.searchParams.set("episode", String(currentEpisode));
    parsed.searchParams.set("s", String(currentSeason));
    parsed.searchParams.set("e", String(currentEpisode));
    return parsed.toString();
  } catch {
    return `${url}${url.includes("?") ? "&" : "?"}season=${currentSeason}&episode=${currentEpisode}&s=${currentSeason}&e=${currentEpisode}`;
  }
}

function renderMessage(message) {
  playerContent.innerHTML = `<p class="text-gray-300 px-4 text-center">${message}</p>`;
  stopProgressTracking();
  clearOverlayRevealTimer();
  hidePlayerOverlayButton();
}

function updateEpisodeHint() {
  if (!episodeHint) return;
  episodeHint.textContent = `S${currentSeason}:E${currentEpisode} selected. Changing season or episode reloads playback.`;
}

async function goToNextPlayback() {
  if (type !== "tv") {
    location.href = `view.html?id=${id}&type=${type}&source=${source}`;
    return;
  }

  const seasonsCount = seasonSelect.options.length;
  const episodesInCurrentSeason = episodeSelect.options.length;

  if (currentEpisode < episodesInCurrentSeason) {
    currentEpisode += 1;
    episodeSelect.value = String(currentEpisode);
    updateEpisodeHint();
    playActiveServer();
    return;
  }

  if (currentSeason < seasonsCount) {
    currentSeason += 1;
    seasonSelect.value = String(currentSeason);
    currentEpisode = 1;
    await populateEpisodeSelect(currentSeason);
    episodeSelect.value = String(currentEpisode);
    updateEpisodeHint();
    playActiveServer();
    return;
  }

  episodeHint.textContent = "You are at the last available episode for this title.";
}

function syncPlayerOverlayButton() {
  if (!playerNextOverlay) return;

  if (type === "tv") {
    playerNextOverlay.querySelector("span").textContent = "Next Episode";
    return;
  }

  playerNextOverlay.querySelector("span").textContent = "More Info";
}

function setActiveServerButton(serverKey) {
  serverList.querySelectorAll("button[data-server]").forEach((button) => {
    const active = button.dataset.server === serverKey;
    button.classList.toggle("bg-netflix-red", active);
    button.classList.toggle("border-netflix-red", active);
    button.classList.toggle("text-white", active);
    button.classList.toggle("bg-zinc-800", !active);
    button.classList.toggle("border-zinc-600", !active);
  });
}

function canUseEmbedServers() {
  const embedId = getEmbedContentId();
  return /^\d+$/.test(String(embedId || ""));
}

function getEmbedContentId() {
  if (source === "tmdb") return id;
  return currentItem?.tmdb_id || id;
}

function playTrailerServer() {
  if (!currentTrailerKey) {
    renderMessage("Trailer not available for this title.");
    return;
  }
  const resumeAt = getResumeStartSeconds();
  renderPlayerFromUrl(`https://www.youtube.com/embed/${currentTrailerKey}?autoplay=1&mute=1`, resumeAt);
}

function playEmbedServer(server) {
  const embedId = getEmbedContentId();
  if (!/^\d+$/.test(String(embedId || ""))) {
    renderMessage("No compatible embed content ID found for this title.");
    return;
  }
  const mediaType = type === "tv" ? "tv" : "movie";
  const baseUrl = server.buildUrl(embedId, mediaType, { season: currentSeason, episode: currentEpisode });
  const resumeAt = getResumeStartSeconds();
  renderPlayerFromUrl(addEpisodeParams(baseUrl), resumeAt);
}

function getDefaultEmbedServer() {
  return SERVERS.find((entry) => entry.key === "licensed-2") || SERVERS.find((entry) => entry.type === "embed") || null;
}

function playActiveServer() {
  recordHistory();

  if (activeServerKey === "trailer") {
    if (type === "tv") {
      const fallbackEmbed = getDefaultEmbedServer();
      if (fallbackEmbed) {
        activeServerKey = fallbackEmbed.key;
        setActiveServerButton(fallbackEmbed.key);
        playEmbedServer(fallbackEmbed);
        return;
      }
    }
    playTrailerServer();
    return;
  }

  const server = SERVERS.find((entry) => entry.key === activeServerKey);
  if (server?.type === "embed") {
    playEmbedServer(server);
    return;
  }

  playTrailerServer();
}

function mountServerButtons() {
  serverList.innerHTML = "";

  SERVERS.forEach((server) => {
    const button = document.createElement("button");
    button.dataset.server = server.key;
    button.className = "px-3 py-2 rounded border border-zinc-600 bg-zinc-800 text-sm font-medium hover:bg-zinc-700 transition-colors";
    button.textContent = server.label;

    button.addEventListener("click", () => {
      captureResumePoint();
      activeServerKey = server.key;
      setActiveServerButton(server.key);
      if (server.type === "trailer") {
        playTrailerServer();
      } else {
        playEmbedServer(server);
      }
    });

    serverList.append(button);
  });

  serverHint.textContent = canUseEmbedServers()
    ? "Switch if the current source is unavailable."
    : "Some titles may not have a compatible embed ID; trailer server is always available.";
}

async function loadEpisodesForSeason(seasonNumber) {
  if (type !== "tv") return [];
  if (episodeCache.has(seasonNumber)) return episodeCache.get(seasonNumber);

  let episodes = [];
  try {
    if (tmdbTvId) {
      const seasonData = await getJson(`/tv/${tmdbTvId}/season/${seasonNumber}`);
      episodes = seasonData.episodes || [];
    }
  } catch {
    episodes = [];
  }

  if (!episodes.length) {
    episodes = Array.from({ length: 12 }, (_, index) => ({
      episode_number: index + 1,
      name: `Episode ${index + 1}`,
    }));
  }

  episodeCache.set(seasonNumber, episodes);
  return episodes;
}

async function populateEpisodeSelect(seasonNumber) {
  const episodes = await loadEpisodesForSeason(seasonNumber);
  episodeSelect.innerHTML = "";

  episodes.forEach((episode) => {
    const option = document.createElement("option");
    option.value = String(episode.episode_number);
    const name = episode.name ? ` - ${episode.name}` : "";
    option.textContent = `Episode ${episode.episode_number}${name}`;
    episodeSelect.append(option);
  });

  if (![...episodeSelect.options].some((option) => option.value === String(currentEpisode))) {
    currentEpisode = Number(episodeSelect.options[0]?.value || 1);
  }
  episodeSelect.value = String(currentEpisode);
}

async function setupEpisodeControls(item) {
  if (type !== "tv") {
    episodeControls.classList.add("hidden");
    return;
  }

  tmdbTvId = source === "tmdb" ? Number(id) : Number(item.tmdb_id || 0);
  const seasonsCount = Math.max(1, Number(item.number_of_seasons || 1));

  currentSeason = Number.isFinite(currentSeason) && currentSeason > 0
    ? Math.min(Math.floor(currentSeason), seasonsCount)
    : 1;

  seasonSelect.innerHTML = "";
  for (let season = 1; season <= seasonsCount; season += 1) {
    const option = document.createElement("option");
    option.value = String(season);
    option.textContent = `Season ${season}`;
    seasonSelect.append(option);
  }

  seasonSelect.value = String(currentSeason);
  await populateEpisodeSelect(currentSeason);

  seasonSelect.onchange = async () => {
    stopProgressTracking();
    currentSeason = Number(seasonSelect.value || 1);
    currentEpisode = 1;
    pendingResumeSec = 0;
    playbackBaselineSec = 0;
    playbackStartedAtMs = 0;
    await populateEpisodeSelect(currentSeason);
    updateEpisodeHint();
    playActiveServer();
  };

  episodeSelect.onchange = () => {
    stopProgressTracking();
    currentEpisode = Number(episodeSelect.value || 1);
    pendingResumeSec = 0;
    playbackBaselineSec = 0;
    playbackStartedAtMs = 0;
    updateEpisodeHint();
    playActiveServer();
  };

  if (nextBtn) {
    nextBtn.onclick = goToNextPlayback;
  }

  updateEpisodeHint();
  episodeControls.classList.remove("hidden");
}

async function init() {
  if (!id) {
    playerContent.textContent = "Missing content ID.";
    return;
  }

  const item = source === "local" ? getLocalItem(id, type) : await getJson(`/${type}/${id}`);
  if (!item) {
    playerContent.textContent = "Content not found.";
    return;
  }
  currentItem = item;
  currentSeason = Number.isFinite(initialSeasonParam) && initialSeasonParam > 0
    ? Math.floor(initialSeasonParam)
    : 1;
  currentEpisode = Number.isFinite(initialEpisodeParam) && initialEpisodeParam > 0
    ? Math.floor(initialEpisodeParam)
    : 1;
  pendingResumeSec = Number.isFinite(initialStartParam) && initialStartParam > 0
    ? Math.floor(initialStartParam)
    : null;
  episodeCache = new Map();
  const year = (item.release_date || item.first_air_date || "").slice(0, 4) || "N/A";

  titleEl.textContent = item.title || item.name || "Untitled";
  metaEl.textContent = `${year} • ${item.vote_average ? item.vote_average.toFixed(1) : "N/A"}`;
  overviewEl.textContent = item.overview || "No overview available.";
  posterImg.src = poster(item.poster_path);

  currentTrailerKey = source === "local" ? item.trailer_key : await fetchTrailerKey(id, type);
  await setupEpisodeControls(item);
  syncPlayerOverlayButton();
  if (playerNextOverlay) {
    playerNextOverlay.onclick = goToNextPlayback;
  }
  mountServerButtons();
  if (type === "tv" && canUseEmbedServers()) {
    const preferred = SERVERS.find((entry) => entry.type === "embed") || SERVERS.find((entry) => entry.key === "trailer");
    if (preferred) {
      activeServerKey = preferred.key;
      setActiveServerButton(preferred.key);
      playActiveServer();
    }
  } else {
    activeServerKey = "trailer";
    setActiveServerButton("trailer");
    playActiveServer();
  }

  if (detailsBtn) {
    detailsBtn.onclick = () => {
      location.href = `view.html?id=${id}&type=${type}&source=${source}`;
    };
  }
}

window.addEventListener("beforeunload", () => {
  stopProgressTracking();
});

window.addEventListener("pagehide", () => {
  stopProgressTracking();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    stopProgressTracking();
  }
});

init().catch((error) => {
  console.error(error);
  playerContent.textContent = error.message || "Failed to load content.";
  stopProgressTracking();
  clearOverlayRevealTimer();
  hidePlayerOverlayButton();
});
