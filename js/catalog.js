/**
 * WAVEN — LOCAL MUSIC CATALOG & COLLECTION PROVIDER
 * Pure local-first provider that derives artists, albums, playlists,
 * and tracks strictly from the user's local device storage (IndexedDB).
 */

window.WAVEN_CATALOG = {
  tracks: [],
  featuredCards: [],
  playlists: [],

  genres: [
    { name: "Pop", icon: "✨", gradient: "linear-gradient(135deg, rgba(99, 102, 241, 0.45) 0%, rgba(168, 85, 247, 0.45) 100%)" },
    { name: "Rock & Metal", icon: "🎸", gradient: "linear-gradient(135deg, rgba(239, 68, 68, 0.45) 0%, rgba(249, 115, 22, 0.45) 100%)" },
    { name: "Dance & EDM", icon: "⚡", gradient: "linear-gradient(135deg, rgba(6, 182, 212, 0.45) 0%, rgba(59, 130, 246, 0.45) 100%)" },
    { name: "Acoustic & Folk", icon: "🌿", gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.45) 0%, rgba(5, 150, 105, 0.45) 100%)" },
    { name: "Hip-Hop & R&B", icon: "🌙", gradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.45) 0%, rgba(236, 72, 153, 0.45) 100%)" },
    { name: "Electronic", icon: "🌆", gradient: "linear-gradient(135deg, rgba(14, 165, 233, 0.45) 0%, rgba(99, 102, 241, 0.45) 100%)" }
  ],

  /**
   * Get single track by ID from local storage
   */
  getTrack(id) {
    if (window.storageService) {
      return window.storageService.getTrackById(id);
    }
    return null;
  },

  /**
   * Returns all genuine local tracks from device storage
   */
  getAllTracks() {
    return window.storageService ? window.storageService.getAllTracks() : [];
  },

  /**
   * Returns grouped artists from genuine local tracks
   */
  getArtists() {
    const all = this.getAllTracks();
    const map = new Map();

    all.forEach(t => {
      const name = t.artist || "Unknown Artist";
      if (!map.has(name)) {
        map.set(name, {
          name,
          artwork: t.artwork || "assets/covers/default_cover.svg",
          tracks: []
        });
      }
      map.get(name).tracks.push(t);
    });

    return Array.from(map.values());
  },

  /**
   * Returns grouped albums from genuine local tracks
   */
  getAlbums() {
    const all = this.getAllTracks();
    const map = new Map();

    all.forEach(t => {
      const name = t.album || "Single";
      if (!map.has(name)) {
        map.set(name, {
          name,
          artist: t.artist || "Various Artists",
          artwork: t.artwork || "assets/covers/default_cover.svg",
          year: t.year || "Local",
          tracks: []
        });
      }
      map.get(name).tracks.push(t);
    });

    return Array.from(map.values());
  },

  /**
   * Returns smart playlists + user custom playlists from genuine local tracks
   */
  getPlaylists() {
    const userPls = window.storageService ? window.storageService.getPlaylists() : [];
    const formattedUserPls = userPls.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || `${p.tracks.length} tracks`,
      artwork: p.tracks.length > 0 && p.tracks[0].artwork ? p.tracks[0].artwork : "assets/covers/default_cover.svg",
      trackIds: p.tracks.map(t => t.id),
      tracks: p.tracks,
      isCustom: true
    }));

    // If local tracks exist, create smart playlists
    const localTracks = this.getAllTracks();
    const smartPlaylists = [];

    if (localTracks.length > 0) {
      // 1. Recently Played
      const historyItems = window.storageService ? window.storageService.getHistory(20) : [];
      const historyTracks = historyItems.map(h => h.track).filter(Boolean);
      smartPlaylists.push({
        id: "smart_recent",
        name: "Recently Played",
        description: `${historyTracks.length} tracks played recently`,
        artwork: historyTracks.length > 0 && historyTracks[0].artwork ? historyTracks[0].artwork : (localTracks[0].artwork || "assets/covers/default_cover.svg"),
        trackIds: historyTracks.map(t => t.id),
        tracks: historyTracks,
        isCustom: false
      });

      // 2. Favourites
      const favSet = window.storageService ? window.storageService.favouritesSet : new Set();
      const favTracks = localTracks.filter(t => favSet.has(t.id));
      smartPlaylists.push({
        id: "smart_favourites",
        name: "Favourites",
        description: `${favTracks.length} starred local tracks`,
        artwork: favTracks.length > 0 && favTracks[0].artwork ? favTracks[0].artwork : (localTracks[0].artwork || "assets/covers/default_cover.svg"),
        trackIds: favTracks.map(t => t.id),
        tracks: favTracks,
        isCustom: false
      });

      // 3. Recently Added
      smartPlaylists.push({
        id: "smart_recently_added",
        name: "Recently Added",
        description: "Your latest imported music files",
        artwork: localTracks[0].artwork || "assets/covers/default_cover.svg",
        trackIds: localTracks.slice(0, 20).map(t => t.id),
        tracks: localTracks.slice(0, 20),
        isCustom: false
      });
    }

    return [...smartPlaylists, ...formattedUserPls];
  },

  /**
   * Get single playlist by ID
   */
  getPlaylistById(id) {
    const all = this.getPlaylists();
    return all.find(p => p.id === id) || null;
  }
};
