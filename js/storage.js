/**
 * AR7 MUSIC — LOCAL-FIRST STORAGE & INDEXEDDB PERSISTENCE SERVICE
 * Stores local audio files (as native Blobs/Files), metadata, playlists, favourites,
 * and playback history in IndexedDB, with lightweight UI preferences in localStorage.
 */

class StorageService {
  constructor() {
    this.dbName = "AR7_LocalMusicDB";
    this.dbVersion = 2;
    this.db = null;

    // In-memory caches for instant synchronous rendering
    this.tracksCache = [];
    this.playlistsCache = [];
    this.favouritesSet = new Set();
    this.historyCache = [];

    this.settingsKey = "ar7_settings";
    this.activeViewKey = "ar7_active_view";
  }

  /**
   * Initialize IndexedDB database and hydrate memory cache
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tracks store
        if (!db.objectStoreNames.contains("tracks")) {
          const trackStore = db.createObjectStore("tracks", { keyPath: "id" });
          trackStore.createIndex("title", "title", { unique: false });
          trackStore.createIndex("artist", "artist", { unique: false });
          trackStore.createIndex("album", "album", { unique: false });
          trackStore.createIndex("addedAt", "addedAt", { unique: false });
        }

        // Playlists store
        if (!db.objectStoreNames.contains("playlists")) {
          db.createObjectStore("playlists", { keyPath: "id" });
        }

        // Favourites store (set of track IDs)
        if (!db.objectStoreNames.contains("favourites")) {
          db.createObjectStore("favourites", { keyPath: "id" });
        }

        // History store
        if (!db.objectStoreNames.contains("history")) {
          const histStore = db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
          histStore.createIndex("playedAt", "playedAt", { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        try {
          await this._hydrateCaches();
          console.log(`[StorageService] Hydrated: ${this.tracksCache.length} tracks, ${this.playlistsCache.length} playlists.`);
          resolve();
        } catch (e) {
          console.warn("[StorageService] Hydration warning:", e);
          resolve();
        }
      };

      request.onerror = (event) => {
        console.error("[StorageService] IndexedDB open error:", event.target.error);
        // Fallback to local array memory if IndexedDB is blocked
        resolve();
      };
    });
  }

  async _hydrateCaches() {
    if (!this.db) return;

    // Load Tracks
    this.tracksCache = await this._getAllFromStore("tracks");
    // Sort default by addedAt descending
    this.tracksCache.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    // Load Playlists
    this.playlistsCache = await this._getAllFromStore("playlists");
    if (this.playlistsCache.length === 0) {
      // Create a default initial playlist if none exists
      const defaultPl = {
        id: "pl_favorites",
        name: "My Favorites",
        description: "Your favorite saved local tracks",
        trackIds: [],
        createdAt: Date.now()
      };
      await this._putInStore("playlists", defaultPl);
      this.playlistsCache = [defaultPl];
    }

    // Load Favourites
    const favItems = await this._getAllFromStore("favourites");
    this.favouritesSet = new Set(favItems.map(f => f.id));

    // Load History
    this.historyCache = await this._getAllFromStore("history");
    this.historyCache.sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0));
  }

  // -------------------------------------------------------------
  // TRACKS CRUD
  // -------------------------------------------------------------

  getAllTracks() {
    return [...this.tracksCache];
  }

  getTrackById(id) {
    return this.tracksCache.find(t => t.id === id) || null;
  }

  /**
   * Save a single track to IndexedDB and update cache
   */
  async saveTrack(track) {
    if (!track || !track.id) return;
    const idx = this.tracksCache.findIndex(t => t.id === track.id);
    if (idx > -1) {
      this.tracksCache[idx] = track;
    } else {
      this.tracksCache.unshift(track);
    }

    if (this.db) {
      await this._putInStore("tracks", track);
    }
    window.dispatchEvent(new CustomEvent("ar7:library_updated", { detail: { count: this.tracksCache.length } }));
  }

  /**
   * Save multiple tracks in a single IndexedDB transaction
   */
  async saveTracks(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) return;

    // Update in-memory cache while preserving user statistics & metadata
    const mergedTracks = [];
    tracks.forEach(track => {
      const idx = this.tracksCache.findIndex(t => t.id === track.id);
      if (idx > -1) {
        const existing = this.tracksCache[idx];
        track.playCount = Math.max(existing.playCount || 0, track.playCount || 0);
        track.totalListeningSeconds = Math.max(existing.totalListeningSeconds || 0, track.totalListeningSeconds || 0);
        track.lastPlayed = track.lastPlayed || existing.lastPlayed || null;
        if (existing.lyrics && !track.lyrics) track.lyrics = existing.lyrics;
        if (existing.isLiked !== undefined && track.isLiked === undefined) track.isLiked = existing.isLiked;
        if (this.favouritesSet && this.favouritesSet.has(track.id)) track.isLiked = true;
        this.tracksCache[idx] = Object.assign({}, existing, track);
        mergedTracks.push(this.tracksCache[idx]);
      } else {
        if (this.favouritesSet && this.favouritesSet.has(track.id)) track.isLiked = true;
        this.tracksCache.unshift(track);
        mergedTracks.push(track);
      }
    });

    if (this.db) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction("tracks", "readwrite");
        const store = tx.objectStore("tracks");
        mergedTracks.forEach(t => store.put(t));
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      });
    }

    window.dispatchEvent(new CustomEvent("ar7:library_updated", { detail: { count: this.tracksCache.length } }));
  }

  /**
   * Delete a track from library without deleting the file from disk
   */
  async deleteTrack(trackId) {
    if (!trackId) return;

    this.tracksCache = this.tracksCache.filter(t => t.id !== trackId);
    this.favouritesSet.delete(trackId);

    // Clean from playlists
    this.playlistsCache.forEach(pl => {
      pl.trackIds = pl.trackIds.filter(id => id !== trackId);
    });

    if (this.db) {
      const tx = this.db.transaction(["tracks", "favourites", "playlists"], "readwrite");
      tx.objectStore("tracks").delete(trackId);
      tx.objectStore("favourites").delete(trackId);
      const plStore = tx.objectStore("playlists");
      this.playlistsCache.forEach(pl => plStore.put(pl));
    }

    window.dispatchEvent(new CustomEvent("ar7:library_updated", { detail: { count: this.tracksCache.length } }));
    window.dispatchEvent(new CustomEvent("ar7:liked_updated"));
    window.dispatchEvent(new CustomEvent("ar7:playlists_updated"));
  }

  /**
   * Check if a file signature already exists to avoid duplicates
   */
  isDuplicate(signature) {
    return this.tracksCache.some(t => t.fileSignature === signature);
  }

  /**
   * Relink a missing file for an existing track
   */
  async relinkFileForTrack(trackId, file) {
    const track = this.getTrackById(trackId);
    if (!track) return false;
    track.file = file;
    track.fileMissing = false;
    await this.saveTrack(track);
    return true;
  }

  // -------------------------------------------------------------
  // FAVOURITES / LIKED SONGS
  // -------------------------------------------------------------

  getLikedSongs() {
    return this.tracksCache.filter(t => this.favouritesSet.has(t.id));
  }

  isLiked(trackId) {
    return this.favouritesSet.has(trackId);
  }

  async toggleLike(track) {
    if (!track || !track.id) return false;
    const trackId = track.id;
    let isNowLiked = false;

    if (this.favouritesSet.has(trackId)) {
      this.favouritesSet.delete(trackId);
      isNowLiked = false;
      if (this.db) {
        await this._deleteFromStore("favourites", trackId);
      }
    } else {
      this.favouritesSet.add(trackId);
      isNowLiked = true;
      if (this.db) {
        await this._putInStore("favourites", { id: trackId, addedAt: Date.now() });
      }
    }

    window.dispatchEvent(new CustomEvent("ar7:liked_updated", { detail: { trackId, isLiked: isNowLiked } }));
    return isNowLiked;
  }

  async addToLiked(trackId) {
    if (!trackId) return;
    this.favouritesSet.add(trackId);
    if (this.db) {
      await this._putInStore("favourites", { id: trackId, addedAt: Date.now() });
    }
    window.dispatchEvent(new CustomEvent("ar7:liked_updated", { detail: { trackId, isLiked: true } }));
  }

  async removeFromLiked(trackId) {
    if (!trackId) return;
    this.favouritesSet.delete(trackId);
    if (this.db) {
      await this._deleteFromStore("favourites", trackId);
    }
    window.dispatchEvent(new CustomEvent("ar7:liked_updated", { detail: { trackId, isLiked: false } }));
  }

  // -------------------------------------------------------------
  // PLAYLISTS
  // -------------------------------------------------------------

  getPlaylists() {
    return this.playlistsCache.map(pl => {
      const tracks = pl.trackIds
        .map(id => this.getTrackById(id))
        .filter(Boolean);
      return {
        ...pl,
        tracks
      };
    });
  }

  getPlaylistById(id) {
    const pl = this.playlistsCache.find(p => p.id === id);
    if (!pl) return null;
    const tracks = pl.trackIds
      .map(tid => this.getTrackById(tid))
      .filter(Boolean);
    return {
      ...pl,
      tracks
    };
  }

  async createPlaylist(name, description = "") {
    const newPlaylist = {
      id: "pl_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: name.trim(),
      description: description.trim(),
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.playlistsCache.push(newPlaylist);
    if (this.db) {
      await this._putInStore("playlists", newPlaylist);
    }

    window.dispatchEvent(new CustomEvent("ar7:playlists_updated", { detail: { playlist: newPlaylist } }));
    return newPlaylist;
  }

  async updatePlaylist(id, updates) {
    const pl = this.playlistsCache.find(p => p.id === id);
    if (!pl) return null;

    if (updates.name !== undefined) pl.name = updates.name.trim();
    if (updates.description !== undefined) pl.description = updates.description.trim();
    if (updates.trackIds !== undefined) pl.trackIds = updates.trackIds;
    pl.updatedAt = Date.now();

    if (this.db) {
      await this._putInStore("playlists", pl);
    }

    window.dispatchEvent(new CustomEvent("ar7:playlists_updated", { detail: { playlist: pl } }));
    return pl;
  }

  async deletePlaylist(id) {
    this.playlistsCache = this.playlistsCache.filter(p => p.id !== id);
    if (this.db) {
      await this._deleteFromStore("playlists", id);
    }
    window.dispatchEvent(new CustomEvent("ar7:playlists_updated"));
  }

  async addTrackToPlaylist(playlistId, trackId) {
    const pl = this.playlistsCache.find(p => p.id === playlistId);
    if (!pl) return false;

    if (!pl.trackIds.includes(trackId)) {
      pl.trackIds.push(trackId);
      pl.updatedAt = Date.now();
      if (this.db) {
        await this._putInStore("playlists", pl);
      }
      window.dispatchEvent(new CustomEvent("ar7:playlists_updated", { detail: { playlist: pl } }));
      return true;
    }
    return false;
  }

  async removeTrackFromPlaylist(playlistId, trackId) {
    const pl = this.playlistsCache.find(p => p.id === playlistId);
    if (!pl) return false;

    pl.trackIds = pl.trackIds.filter(id => id !== trackId);
    pl.updatedAt = Date.now();
    if (this.db) {
      await this._putInStore("playlists", pl);
    }
    window.dispatchEvent(new CustomEvent("ar7:playlists_updated", { detail: { playlist: pl } }));
    return true;
  }

  // -------------------------------------------------------------
  // PLAYBACK HISTORY & INSIGHTS
  // -------------------------------------------------------------

  getHistory(limit = 100) {
    return this.historyCache
      .slice(0, limit)
      .map(item => ({
        ...item,
        track: this.getTrackById(item.trackId)
      }))
      .filter(item => item.track !== null);
  }

  async addToHistory(track, listenedSecs = 0) {
    if (!track || !track.id) return;
    const now = Date.now();
    const duration = track.duration || 0;
    const actualSecs = listenedSecs > 0 ? listenedSecs : Math.round(duration || 180);

    // 1. Update track-level listening stats in memory & DB
    const cachedTrack = this.getTrackById(track.id);
    if (cachedTrack) {
      cachedTrack.playCount = (cachedTrack.playCount || 0) + 1;
      cachedTrack.lastPlayed = now;
      cachedTrack.totalListeningSeconds = (cachedTrack.totalListeningSeconds || 0) + actualSecs;
      if (this.db) {
        await this._putInStore("tracks", cachedTrack);
      }
    }

    // 2. Append history entry
    const historyEntry = {
      trackId: track.id,
      title: track.title || "Unknown Title",
      artist: track.artist || "Unknown Artist",
      album: track.album || "Unknown Album",
      genre: track.genre || "",
      duration: duration,
      listenedSecs: actualSecs,
      playedAt: now
    };

    // Keep unique at top of recent history
    this.historyCache = this.historyCache.filter(h => h.trackId !== track.id);
    this.historyCache.unshift(historyEntry);
    if (this.historyCache.length > 500) {
      this.historyCache = this.historyCache.slice(0, 500);
    }

    if (this.db) {
      await this._putInStore("history", historyEntry);
    }

    window.dispatchEvent(new CustomEvent("ar7:history_updated"));
  }

  /**
   * Accumulate continuous playback seconds into total listening time
   */
  async recordPlayDuration(trackId, additionalSecs) {
    if (!trackId || !additionalSecs || additionalSecs <= 0) return;
    const cachedTrack = this.getTrackById(trackId);
    if (cachedTrack) {
      cachedTrack.totalListeningSeconds = (cachedTrack.totalListeningSeconds || 0) + Math.round(additionalSecs);
      if (this.db) {
        await this._putInStore("tracks", cachedTrack);
      }
    }
    // Also update current top history item if it matches
    if (this.historyCache.length > 0 && this.historyCache[0].trackId === trackId) {
      this.historyCache[0].listenedSecs = (this.historyCache[0].listenedSecs || 0) + Math.round(additionalSecs);
      if (this.db) {
        await this._putInStore("history", this.historyCache[0]);
      }
    }
  }

  async clearHistory() {
    this.historyCache = [];
    if (this.db) {
      await this._clearStore("history");
    }
    // Also reset play counts on tracks if user wants complete history wipe
    this.tracksCache.forEach(t => {
      t.playCount = 0;
      t.lastPlayed = null;
      t.totalListeningSeconds = 0;
    });
    if (this.db) {
      await this.saveTracks(this.tracksCache);
    }
    window.dispatchEvent(new CustomEvent("ar7:history_updated"));
  }

  /**
   * Update metadata for a track (Title, Artist, Album, Genre, Mood, Lyrics, etc.)
   */
  async updateTrackMetadata(trackId, updates = {}) {
    const track = this.getTrackById(trackId);
    if (!track) return null;

    Object.assign(track, updates, { updatedAt: Date.now() });
    await this.saveTrack(track);
    return track;
  }

  /**
   * Get Genuine Listening Statistics for Music DNA / Insights
   */
  getListeningStats() {
    const tracks = this.getAllTracks();
    const history = this.historyCache;

    // Genuine Total Listening Time computed across track metadata AND historical plays
    const trackSecs = tracks.reduce((acc, t) => acc + (t.totalListeningSeconds || 0), 0);
    const historySecs = history.reduce((acc, h) => acc + (h.listenedSecs || h.duration || 0), 0);
    const totalListeningSecs = Math.max(trackSecs, historySecs);

    const totalHours = Math.floor(totalListeningSecs / 3600);
    const totalMinutes = Math.floor((totalListeningSecs % 3600) / 60);
    const totalSeconds = totalListeningSecs % 60;

    let formattedListeningTime = "0m";
    if (totalHours > 0) {
      formattedListeningTime = `${totalHours}h ${totalMinutes}m`;
    } else if (totalMinutes > 0) {
      formattedListeningTime = `${totalMinutes}m`;
    } else if (totalListeningSecs > 0) {
      formattedListeningTime = `${totalListeningSecs}s`;
    }

    const totalPlays = Math.max(
      tracks.reduce((acc, t) => acc + (t.playCount || 0), 0),
      history.length
    );

    // Most played tracks (min 1 play)
    const mostPlayed = [...tracks]
      .filter(t => (t.playCount || 0) > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 10);

    // Top Artists
    const artistStats = {};
    tracks.forEach(t => {
      const art = t.artist || "Unknown Artist";
      if (!artistStats[art]) {
        artistStats[art] = { name: art, count: 0, plays: 0, tracks: [] };
      }
      artistStats[art].count++;
      artistStats[art].plays += (t.playCount || 0);
      artistStats[art].tracks.push(t);
    });
    const topArtists = Object.values(artistStats)
      .sort((a, b) => b.plays - a.plays || b.count - a.count)
      .slice(0, 8);

    // Top Albums
    const albumStats = {};
    tracks.forEach(t => {
      if (t.album && t.album !== "Unknown Album") {
        if (!albumStats[t.album]) {
          albumStats[t.album] = { name: t.album, artist: t.artist, count: 0, plays: 0, artwork: t.artwork };
        }
        albumStats[t.album].count++;
        albumStats[t.album].plays += (t.playCount || 0);
      }
    });
    const topAlbums = Object.values(albumStats)
      .sort((a, b) => b.plays - a.plays || b.count - a.count)
      .slice(0, 8);

    // Top Genres
    const genreStats = {};
    tracks.forEach(t => {
      const g = (t.genre || "").trim().toLowerCase();
      if (g) {
        genreStats[g] = (genreStats[g] || 0) + (t.playCount || 1);
      }
    });
    const topGenres = Object.entries(genreStats)
      .map(([name, weight]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);

    // Daily listening timeline (last 7 days)
    const daysMap = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      daysMap[dateKey] = {
        dateStr: dateKey,
        dayName: dayNames[d.getDay()],
        minutes: 0,
        plays: 0
      };
    }
    history.forEach(h => {
      if (h.playedAt) {
        const dateKey = new Date(h.playedAt).toISOString().split("T")[0];
        if (daysMap[dateKey]) {
          daysMap[dateKey].plays++;
          daysMap[dateKey].minutes += Math.round((h.duration || 180) / 60);
        }
      }
    });
    const dailyStats = Object.values(daysMap);

    // Music Personality Archetype calculation
    let personality = {
      title: "Eclectic Sound Alchemist",
      desc: "Your tastes fluidly span multiple genres and sonic textures, curating a vibrant and open-minded local library."
    };
    if (topGenres.length > 0) {
      const primary = topGenres[0].name.toLowerCase();
      if (primary.includes("rock") || primary.includes("metal")) {
        personality = {
          title: "The Electric Dynamo",
          desc: "Drawn to driving guitar riffs, explosive drums, and raw sonic energy that commands total focus."
        };
      } else if (primary.includes("chill") || primary.includes("ambient") || primary.includes("lo-fi") || primary.includes("lofi")) {
        personality = {
          title: "The Midnight Dreamer",
          desc: "You prioritize atmospheric depth, soothing downtempo frequencies, and tranquil soundscapes."
        };
      } else if (primary.includes("pop") || primary.includes("dance") || primary.includes("disco")) {
        personality = {
          title: "The Radiant Rhythm Maker",
          desc: "In tune with hook-driven melodies, infectious grooves, and uplifting harmonic energy."
        };
      } else if (primary.includes("acoustic") || primary.includes("folk") || primary.includes("indie")) {
        personality = {
          title: "The Acoustic Storyteller",
          desc: "You connect deeply with organic instrumentation, lyrical vulnerability, and heartfelt arrangements."
        };
      } else if (primary.includes("hip hop") || primary.includes("rap") || primary.includes("trap")) {
        personality = {
          title: "The Urban Flow Connoisseur",
          desc: "Driven by heavy low-end basslines, tight cadence, and lyrical rhythm mastery."
        };
      } else if (primary.includes("classical") || primary.includes("piano") || primary.includes("soundtrack")) {
        personality = {
          title: "The Harmonic Maestro",
          desc: "You appreciate intricate compositions, rich dynamic range, and cinematic orchestral architecture."
        };
      }
    }

    return {
      totalTracks: tracks.length,
      totalHours,
      totalMinutes,
      totalSeconds,
      totalListeningSecs,
      formattedListeningTime,
      totalPlays,
      mostPlayed,
      topArtists,
      topAlbums,
      topGenres,
      dailyStats,
      dailyActivity: dailyStats,
      personality,
      archetype: personality
    };
  }

  /**
   * Genuine Forgotten Gems categorization
   */
  getForgottenGems() {
    const tracks = this.getAllTracks();
    const settings = this.getSettings();
    const excluded = new Set(settings.excludedForgottenGems || []);
    const favSet = this.favouritesSet;
    const now = Date.now();

    const DAY_MS = 24 * 60 * 60 * 1000;
    const eligibleTracks = tracks.filter(t => !excluded.has(t.id));

    // Never-played tracks (exclude tracks added within last 24h so brand-new files aren't called forgotten)
    const neverPlayed = eligibleTracks.filter(t => {
      const plays = t.playCount || 0;
      const notPlayedYet = plays === 0 && !t.lastPlayed;
      const addedAgo = now - (t.addedAt || now);
      return notPlayedYet && addedAgo > (DAY_MS * 1);
    });

    // Tracks that WERE played, but not recently
    const thirtyDays = [];
    const sixtyDays = [];
    const ninetyDays = [];
    const dormantFavourites = [];

    eligibleTracks.forEach(t => {
      if (t.lastPlayed) {
        const daysSince = Math.floor((now - t.lastPlayed) / DAY_MS);
        if (daysSince >= 90) {
          ninetyDays.push(t);
        }
        if (daysSince >= 60) {
          sixtyDays.push(t);
        }
        if (daysSince >= 30) {
          thirtyDays.push(t);
        }

        // Dormant favourites: user liked it, but hasn't played in 21+ days
        if (favSet.has(t.id) && daysSince >= 21) {
          dormantFavourites.push(t);
        }
      }
    });

    return {
      thirtyDays,
      sixtyDays,
      ninetyDays,
      dormantFavourites,
      neverPlayed,
      totalForgotten: thirtyDays.length + sixtyDays.length + ninetyDays.length + dormantFavourites.length
    };
  }

  excludeFromForgottenGems(trackId) {
    if (!trackId) return;
    const settings = this.getSettings();
    const excluded = new Set(settings.excludedForgottenGems || []);
    excluded.add(trackId);
    this.saveSettings({ excludedForgottenGems: Array.from(excluded) });
    window.dispatchEvent(new CustomEvent("ar7:forgotten_updated"));
  }

  unexcludeFromForgottenGems(trackId) {
    if (!trackId) return;
    const settings = this.getSettings();
    const excluded = new Set(settings.excludedForgottenGems || []);
    excluded.delete(trackId);
    this.saveSettings({ excludedForgottenGems: Array.from(excluded) });
    window.dispatchEvent(new CustomEvent("ar7:forgotten_updated"));
  }

  // -------------------------------------------------------------
  // LIGHTWEIGHT UI SETTINGS (localStorage)
  // -------------------------------------------------------------

  getSettings() {
    try {
      const raw = localStorage.getItem(this.settingsKey);
      return raw ? JSON.parse(raw) : {
        volume: 0.85,
        isMuted: false,
        shuffle: false,
        repeatMode: "off",
        theme: "dark",
        sortField: "addedAt",
        sortOrder: "desc"
      };
    } catch {
      return { volume: 0.85, isMuted: false, shuffle: false, repeatMode: "off" };
    }
  }

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(this.settingsKey, JSON.stringify(updated));
    } catch (e) {
      console.warn("[StorageService] Failed to save settings to localStorage:", e);
    }
  }

  // -------------------------------------------------------------
  // INDEXEDDB PROMISE HELPERS
  // -------------------------------------------------------------

  _getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      const tx = this.db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  _putInStore(storeName, value) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  _deleteFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  _clearStore(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

window.storageService = new StorageService();
