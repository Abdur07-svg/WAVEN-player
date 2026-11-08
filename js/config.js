/**
 * AR7 MUSIC — APPLICATION CONFIGURATION
 * “Discover music. Search. Listen. Repeat.”
 */

const CONFIG = {
  APP_NAME: "AR7Music",
  APP_VERSION: "2.0.0",
  TAGLINE: "Discover music. Search. Listen. Repeat.",

  AUDIUS_API_KEY: "",

  DEFAULT_DISCOVERY_NODES: [
    "https://discoveryprovider.audius.co",
    "https://audius-discovery-1.cultur3stake.com",
    "https://audius-dp.amsterdam.creatorseed.com",
    "https://dn1.monophonic.digital",
    "https://discovery-us-01.audius.openplayer.org"
  ],

  STORAGE_KEYS: {
    LIKED_SONGS: "ar7_liked_songs",
    LIKED_ARTISTS: "ar7_liked_artists",
    LIKED_ALBUMS: "ar7_liked_albums",
    PLAYLISTS: "ar7_playlists",
    HISTORY: "ar7_playback_history",
    SEARCH_HISTORY: "ar7_search_history",
    SETTINGS: "ar7_settings",
    USER: "ar7_current_user"
  },

  DEFAULT_SETTINGS: {
    theme: "dark", // 'dark' | 'midnight' | 'obsidian' | 'emerald'
    autoplay: true,
    volume: 0.85,
    repeatMode: "off", // 'off' | 'all' | 'one'
    shuffle: false,
    audioQuality: "high", // 'high' (320kbps) | 'standard' (192kbps) | 'saver'
    crossfade: false,
    volumeNormalization: true,
    privacyMode: false
  },

  GENRES: [
    { name: "Electronic", id: "Electronic", query: "Electronic", gradient: "linear-gradient(135deg, #ec4899, #8b5cf6)" },
    { name: "Pop", id: "Pop", query: "Pop", gradient: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
    { name: "Hip-Hop", id: "Hip-Hop", query: "Hip-Hop/Rap", gradient: "linear-gradient(135deg, #f59e0b, #ef4444)" },
    { name: "Rock", id: "Rock", query: "Rock", gradient: "linear-gradient(135deg, #ef4444, #7c3aed)" },
    { name: "Bollywood", id: "Bollywood", query: "Bollywood Hindi", gradient: "linear-gradient(135deg, #f97316, #e11d48)" },
    { name: "Bengali", id: "Bengali", query: "Bengali music", gradient: "linear-gradient(135deg, #10b981, #059669)" },
    { name: "Hindi", id: "Hindi", query: "Hindi Hits", gradient: "linear-gradient(135deg, #d97706, #dc2626)" },
    { name: "Indie", id: "Indie", query: "Indie Rock", gradient: "linear-gradient(135deg, #8b5cf6, #3b82f6)" },
    { name: "R&B / Soul", id: "R&B", query: "R&B", gradient: "linear-gradient(135deg, #a855f7, #ec4899)" },
    { name: "Jazz", id: "Jazz", query: "Jazz", gradient: "linear-gradient(135deg, #ca8a04, #ea580c)" },
    { name: "Classical", id: "Classical", query: "Classical", gradient: "linear-gradient(135deg, #84cc16, #10b981)" },
    { name: "Lo-Fi", id: "Lo-Fi", query: "Lo-Fi Beats", gradient: "linear-gradient(135deg, #f43f5e, #fb923c)" },
    { name: "House", id: "House", query: "House", gradient: "linear-gradient(135deg, #10b981, #06b6d4)" },
    { name: "Ambient", id: "Ambient", query: "Ambient", gradient: "linear-gradient(135deg, #6366f1, #a855f7)" }
  ]
};

window.CONFIG = CONFIG;
