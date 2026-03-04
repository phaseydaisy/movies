import {
  TMDB_API_KEY,
  TMDB_BASE_URL,
  TMDB_IMAGE_URL,
  TMDB_BACKDROP_URL,
} from "./config.js";

function withKey(path) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${TMDB_BASE_URL}${path}${joiner}api_key=${TMDB_API_KEY}`;
}

export async function getJson(path) {
  if (!TMDB_API_KEY || TMDB_API_KEY.includes("PASTE_YOUR")) {
    throw new Error("Set your TMDB API key in src/config.js");
  }
  const response = await fetch(withKey(path));
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }
  return response.json();
}

export function poster(path) {
  if (!path) return "https://placehold.co/500x750/1a1a1a/ffffff?text=No+Image";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${TMDB_IMAGE_URL}${path}`;
}

export function backdrop(path) {
  if (!path) return "https://placehold.co/1920x1080/111111/ffffff?text=No+Backdrop";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${TMDB_BACKDROP_URL}${path}`;
}

export async function fetchTrailerKey(id, type = "movie") {
  const data = await getJson(`/${type}/${id}/videos`);
  const trailer = data.results?.find(
    (item) => item.site === "YouTube" && (item.type === "Trailer" || item.type === "Teaser")
  );
  return trailer?.key || null;
}
