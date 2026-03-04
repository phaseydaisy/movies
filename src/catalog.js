const makeImage = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const movie = (id, title, year, rating, overview, trailerKey, tmdbId) => ({
  id,
  tmdb_id: tmdbId,
  media_type: "movie",
  title,
  release_date: `${year}-01-01`,
  vote_average: rating,
  overview,
  runtime: 110,
  genres: [{ name: "Drama" }, { name: "Action" }],
  poster_path: makeImage(`movie-${id}`, 500, 750),
  backdrop_path: makeImage(`movie-bg-${id}`, 1920, 1080),
  trailer_key: trailerKey,
});

const tv = (id, name, year, rating, overview, trailerKey, tmdbId) => ({
  id,
  tmdb_id: tmdbId,
  media_type: "tv",
  name,
  first_air_date: `${year}-01-01`,
  vote_average: rating,
  overview,
  number_of_seasons: 3,
  genres: [{ name: "Series" }, { name: "Adventure" }],
  poster_path: makeImage(`tv-${id}`, 500, 750),
  backdrop_path: makeImage(`tv-bg-${id}`, 1920, 1080),
  trailer_key: trailerKey,
});

export const MOVIES = [
  movie("m1", "Shadow Protocol", 2023, 7.5, "A retired operative is pulled into one last mission when a rogue network resurfaces.", "8ugaeA-nMTc", "27205"),
  movie("m2", "Last Signal", 2024, 7.1, "A deep-space crew intercepts a transmission that may rewrite human history.", "zSWdZVtXT7E", "157336"),
  movie("m3", "Neon Harbor", 2022, 6.9, "In a flooded megacity, a courier uncovers a conspiracy beneath the skyline.", "d96cjJhvlMA", "603"),
  movie("m4", "Crimson Winter", 2021, 7.0, "A mountain rescue team must survive a storm and a dangerous cover-up.", "TcMBFSGVi1c", "155"),
  movie("m5", "Echoes of Tomorrow", 2025, 7.6, "A scientist relives one day to stop a catastrophic event.", "s7EdQ4FqbhY", "24428"),
  movie("m6", "Project Atlas", 2020, 6.8, "A mapping AI begins predicting crimes before they happen.", "QdBZY2fkU-0", "299536"),
  movie("m7", "Deep Current", 2024, 7.3, "Divers searching a wreck discover a secret military prototype.", "YoHD9XEInc0", "299534"),
  movie("m8", "Silent Orbit", 2023, 7.2, "Astronauts awaken years late with Earth no longer answering.", "A3Z4T8V7XUk", "680"),
  movie("m9", "Iron Alley", 2019, 6.7, "A former boxer protects his neighborhood from a syndicate.", "xjDjIWPwcPU", "13"),
  movie("m10", "Blue Lantern", 2022, 7.4, "A detective follows coded broadcasts from an unknown source.", "hA6hldpSTF8", "122"),
  movie("m11", "Glass Frontier", 2024, 7.0, "Smugglers crossing a frozen border uncover a political plot.", "vKQi3bBA1y8", "671"),
  movie("m12", "Terminal Sky", 2021, 6.9, "An air traffic analyst races to prevent coordinated sabotage.", "EXeTwQWrcwY", "550"),
];

export const SHOWS = [
  tv("t1", "Midnight District", 2023, 8.1, "A city task force handles supernatural incidents hidden from the public.", "MGRm4IzK1SQ", "1396"),
  tv("t2", "Gridline", 2021, 7.8, "Engineers and detectives track cybercrimes across smart cities.", "D4e7fT9zYhA", "66732"),
  tv("t3", "Paper Kings", 2024, 8.0, "Rival media dynasties clash over power, truth, and legacy.", "KPLWWIOCOOQ", "1399"),
  tv("t4", "North Station", 2020, 7.6, "Life at a remote research base where every storm hides a secret.", "6ZfuNTqbHE8", "1402"),
  tv("t5", "Afterlight", 2022, 8.2, "Survivors build a fragile society after a global blackout.", "w7pYhpJaJW8", "2316"),
  tv("t6", "Double Blind", 2023, 7.9, "Two rival lawyers unknowingly fight the same hidden enemy.", "ndl1W4ltcmg", "1668"),
  tv("t7", "Sea of Glass", 2021, 7.7, "A coastal town unravels after a mysterious object washes ashore.", "ozjP6AT6O44", "71912"),
  tv("t8", "Cipher Unit", 2025, 8.3, "An elite decoding team stops threats buried in global comms.", "HhesaQXLuRY", "32726"),
  tv("t9", "Parallel Lines", 2024, 8.1, "A rail network links timelines, and a conductor guards the crossings.", "xvFZjo5PgG0", "4629"),
  tv("t10", "Hollow City", 2022, 7.5, "A prosecutor investigates cases tied to one vanished district.", "SUXWAEX2jlg", "1418"),
  tv("t11", "Wild Meridian", 2019, 7.4, "Explorers map a newly emerged island chain in dangerous waters.", "eOrNdBpGMv8", "13916"),
  tv("t12", "Skyline 9", 2024, 8.0, "Nine residents in a high-rise discover they are part of an experiment.", "PVj0L8h0A7Y", "2734"),
];

export const TEEN = [
  tv("a1", "Arcadia Club", 2022, 8.4, "Students at a game academy uncover coded messages in tournaments.", "W6DYDkB0g6Q", "31911"),
  tv("a2", "Rift Runner", 2023, 8.6, "A speedster can leap between dimensions for 30 seconds at a time.", "fWevRAAgAik", "37854"),
  tv("a3", "Pixel Knights", 2021, 8.2, "Guild rivals become teammates in a city-wide defense league.", "n2igjYFojUo", "46260"),
  tv("a4", "Solar Beat", 2024, 8.1, "A music crew balances school by day and cosmic gigs by night.", "4NRXx6U8ABQ", "94605"),
  tv("a5", "Mirror Realm", 2020, 8.0, "An ordinary teen enters a world where memories become weapons.", "qSu6i2iFMO0", "46298"),
  tv("a6", "Code Zero", 2025, 8.5, "Hackers race to stop an AI teacher from rewriting reality.", "kXYiU_JCYtU", "65930"),
  tv("a7", "Dragon Loop", 2019, 8.3, "A village relives one festival day until a hidden pact is broken.", "JGwWNGJdvx8", "203737"),
  tv("a8", "Moonstrike", 2024, 8.4, "A rookie team protects Earth from lunar anomalies.", "YQHsXMglC9A", "45789"),
];

export const ALL = [...MOVIES, ...SHOWS, ...TEEN];

export function getLocalItem(id, type) {
  return ALL.find((item) => item.id === id && item.media_type === type) || null;
}

export function getSimilarLocal(item, count = 15) {
  const pool = ALL.filter((entry) => entry.media_type === item.media_type && entry.id !== item.id);
  return pool.slice(0, count);
}

export function searchLocal(query, filter = "multi", page = 1, pageSize = 24) {
  const q = query.trim().toLowerCase();
  let pool = ALL;

  if (filter === "movie") pool = ALL.filter((item) => item.media_type === "movie");
  if (filter === "tv") pool = ALL.filter((item) => item.media_type === "tv");
  if (filter === "person") return { results: [], total_pages: 1 };

  const matched = q
    ? pool.filter((item) => {
      const title = (item.title || item.name || "").toLowerCase();
      const overview = (item.overview || "").toLowerCase();
      const year = String(item.release_date || item.first_air_date || "").slice(0, 4);
      const mediaLabel = item.media_type === "movie" ? "movie film cinema" : "tv show series anime";
      return title.includes(q) || overview.includes(q) || year.includes(q) || mediaLabel.includes(q);
    })
    : pool;

  const start = (page - 1) * pageSize;
  return {
    results: matched.slice(start, start + pageSize),
    total_pages: Math.max(1, Math.ceil(matched.length / pageSize)),
  };
}
