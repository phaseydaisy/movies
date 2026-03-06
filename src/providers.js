export const WATCH_SERVERS = [
  { key: "trailer", label: "Trailer", type: "trailer" },
  {
    key: "licensed-2",
    label: "videasy",
    type: "embed",
    buildUrl: (contentId, mediaType, opts = {}) => {
      if (mediaType === "tv") {
        const season = Number(opts.season || 1);
        const episode = Number(opts.episode || 1);
        return `https://player.videasy.net/tv/${contentId}/${season}/${episode}`;
      }
      return `https://player.videasy.net/movie/${contentId}`;
    },
  },
  {
    key: "autoembed",
    label: "Autoembed (working but ads)",
    type: "embed",
    buildUrl: (contentId, mediaType, opts = {}) => {
      if (mediaType === "tv") {
        const season = Number(opts.season || 1);
        const episode = Number(opts.episode || 1);
        return `https://player.autoembed.cc/embed/tv/${contentId}/${season}/${episode}`;
      }
      return `https://player.autoembed.cc/embed/movie/${contentId}`;
    },
  },
  {
    key: "licensed-1",
    label: "primesrc.me (Not working)",
    type: "embed",
    buildUrl: (contentId, mediaType, opts = {}) => {
      if (mediaType === "tv") {
        const season = Number(opts.season || 1);
        const episode = Number(opts.episode || 1);
        return `https://primesrc.me/tv/${contentId}/${season}/${episode}`;
      }
      return `https://primesrc.me/movie/${contentId}`;
    },
  },
];
