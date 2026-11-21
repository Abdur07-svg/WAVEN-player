/**
 * WAVEN — Music Library & Storage Manager
 * Exclusively Local Music Player Architecture
 */

class LibraryManager {
  constructor() {
    this.storageKey = 'waven_device_tracks';
    this.favoritesKey = 'waven_favorites';
    this.historyKey = 'waven_playback_history';

    // No hardcoded fake demo songs
    this.defaultTracks = [];

    // Load persisted local device tracks
    this.deviceTracks = this.loadPersistedTracks();
    this.favorites = this.loadFavorites();
    this.history = this.loadHistory();
    this.playlists = this.loadPlaylists();
  }

  loadPersistedTracks() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read cached tracks:', e);
    }
    return [];
  }

  savePersistedTracks() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.deviceTracks));
    } catch (e) {
      console.warn('Could not save tracks to localStorage:', e);
    }
  }

  loadFavorites() {
    try {
      const data = localStorage.getItem(this.favoritesKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem(this.favoritesKey, JSON.stringify(this.favorites));
    } catch (ignored) {}
  }

  isFavorite(trackId) {
    if (!trackId) return false;
    return this.favorites.includes(trackId);
  }

  toggleFavorite(trackId) {
    if (!trackId) return false;
    const idx = this.favorites.indexOf(trackId);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
    } else {
      this.favorites.push(trackId);
    }
    this.saveFavorites();
    return this.isFavorite(trackId);
  }

  loadHistory() {
    try {
      const data = localStorage.getItem(this.historyKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  addToHistory(track) {
    if (!track || !track.id) return;
    this.history = this.history.filter(t => t.id !== track.id);
    this.history.unshift(track);
    if (this.history.length > 50) this.history.pop();
    try {
      localStorage.setItem(this.historyKey, JSON.stringify(this.history));
    } catch (ignored) {}
  }

  getAllTracks() {
    return this.deviceTracks;
  }

  getLikedTracks() {
    return this.deviceTracks.filter(t => this.isFavorite(t.id));
  }

  getPlaylists() {
    const likedCount = this.getLikedTracks().length;
    return [
      {
        id: 'liked',
        title: 'Liked Songs',
        curator: 'My Favorites',
        trackCount: likedCount,
        duration: `${likedCount} songs`,
        pinned: true,
        isLikedCollection: true,
        description: 'Your favorite tracks marked with heart.',
        coverArt: 'assets/covers/default_cover.png'
      },
      ...this.playlists
    ];
  }

  loadPlaylists() {
    try {
      const data = localStorage.getItem('waven_user_playlists');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return [
      {
        id: 'pl_recent',
        title: 'Recently Added',
        curator: 'Local Storage',
        trackCount: this.deviceTracks.length,
        duration: 'Device Vault',
        pinned: false,
        description: 'Recently scanned audio files from device storage.',
        coverArt: 'assets/covers/default_cover.png'
      }
    ];
  }

  addScannedTracks(scannedData) {
    try {
      let tracks = scannedData;
      if (typeof scannedData === 'string') {
        tracks = JSON.parse(scannedData);
      }
      if (Array.isArray(tracks)) {
        this.deviceTracks = tracks.map(t => {
          let dur = t.duration || 0;
          if (dur > 1000) {
            dur = Math.round(dur / 1000);
          }
          if (dur <= 0) dur = 180;

          return {
            id: t.id || ('track_' + Math.random().toString(36).substr(2, 9)),
            title: t.title || 'Unknown Track',
            artist: t.artist || 'Unknown Artist',
            album: t.album || 'Local Audio',
            duration: dur,
            uri: t.uri || '',
            filePath: t.filePath || '',
            coverArt: t.coverArt || 'assets/covers/default_cover.png',
            dateAdded: t.dateAdded || Date.now(),
            genre: t.genre || 'Local Audio',
            isLocalDevice: true,
            hires: true
          };
        });

        this.savePersistedTracks();
        console.log(`WAVEN Library updated: ${this.deviceTracks.length} local device tracks saved.`);
      }
    } catch (e) {
      console.error('Failed to parse scanned audio tracks:', e);
    }
  }

  clearScannedTracks() {
    this.deviceTracks = [];
    try {
      localStorage.removeItem(this.storageKey);
    } catch (ignored) {}
  }

  search(query) {
    if (!query || !query.trim()) return this.getAllTracks();
    const q = query.toLowerCase().trim();
    return this.getAllTracks().filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.album && t.album.toLowerCase().includes(q)) ||
      (t.genre && t.genre.toLowerCase().includes(q))
    );
  }

  getArtists() {
    const map = new Map();
    this.deviceTracks.forEach(t => {
      const art = t.artist || 'Unknown Artist';
      if (!map.has(art)) {
        map.set(art, []);
      }
      map.get(art).push(t);
    });
    return Array.from(map.entries()).map(([artist, songs]) => ({
      artist,
      songs,
      count: songs.length
    }));
  }

  getAlbums() {
    const map = new Map();
    this.deviceTracks.forEach(t => {
      const alb = t.album || 'Local Audio';
      if (!map.has(alb)) {
        map.set(alb, {
          album: alb,
          artist: t.artist,
          coverArt: t.coverArt,
          songs: []
        });
      }
      map.get(alb).songs.push(t);
    });
    return Array.from(map.values());
  }
}

window.wavenLibrary = new LibraryManager();
