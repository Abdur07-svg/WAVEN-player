/**
 * WAVEN — Music Library & Storage Manager
 */

class LibraryManager {
  constructor() {
    this.storageKey = 'waven_library_data';
    this.favoritesKey = 'waven_favorites';
    this.historyKey = 'waven_playback_history';

    // Curated catalog based on Nocturne Pulse reference specifications
    this.defaultTracks = [
      {
        id: 'waven_01',
        title: 'Midnight Confessions',
        artist: 'Budiarti',
        album: 'Echoes of Solitude',
        duration: 151, // 2:31
        coverArt: 'assets/covers/default_cover.png',
        file: 'demo_preview.wav',
        isAsset: true,
        genre: 'Electronic & Dance',
        hires: true
      },
      {
        id: 'waven_02',
        title: 'Sunset Drive',
        artist: 'Midnight Chill',
        album: 'Neon Horizon',
        duration: 198, // 3:18
        coverArt: 'assets/covers/default_cover.png',
        file: 'Midnight Chill - Sunset Drive.wav',
        isAsset: true,
        genre: 'Chill & Lo-Fi',
        hires: true
      },
      {
        id: 'waven_03',
        title: 'Cyber Beats',
        artist: 'Neon Echoes',
        album: 'Pulse 24',
        duration: 252, // 4:12
        coverArt: 'assets/covers/default_cover.png',
        file: 'Neon Echoes - Cyber Beats.wav',
        isAsset: true,
        genre: 'Electronic & Dance',
        hires: true
      },
      {
        id: 'waven_04',
        title: 'Starlit Reverie',
        artist: 'Budiarti',
        album: 'Starlit Reverie EP',
        duration: 185,
        coverArt: 'assets/covers/default_cover.png',
        file: 'demo_preview.wav',
        isAsset: true,
        genre: 'Chill & Lo-Fi',
        hires: true
      },
      {
        id: 'waven_05',
        title: 'Lost in the Echo',
        artist: 'Romanov',
        album: 'Subterranean Drift',
        duration: 225,
        coverArt: 'assets/covers/default_cover.png',
        file: 'Neon Echoes - Cyber Beats.wav',
        isAsset: true,
        genre: 'Hip-Hop & R&B',
        hires: true
      },
      {
        id: 'waven_06',
        title: 'Velvet Hypnosis',
        artist: 'Sora & Kai',
        album: 'Ultraviolet Dreams',
        duration: 175,
        coverArt: 'assets/covers/default_cover.png',
        file: 'Midnight Chill - Sunset Drive.wav',
        isAsset: true,
        genre: 'Acoustic & Indie',
        hires: true
      }
    ];

    this.playlists = [
      {
        id: 'pl_starlit',
        title: 'Starlit Reverie',
        curator: 'Budiarti',
        trackCount: 8,
        duration: '32 min',
        pinned: true,
        description: 'The original slow instrumental best playlists.',
        coverArt: 'assets/covers/default_cover.png'
      },
      {
        id: 'pl_midnight',
        title: 'Midnight Confessions',
        curator: 'Echoes',
        trackCount: 12,
        duration: '45 min',
        pinned: false,
        description: 'Atmospheric nocturnal synth & introspective vibes.',
        coverArt: 'assets/covers/default_cover.png'
      },
      {
        id: 'pl_lost',
        title: 'Lost in the Echo',
        curator: 'Romanov',
        trackCount: 15,
        duration: '52 min',
        pinned: false,
        description: 'Heavy basslines and dark club aesthetics.',
        coverArt: 'assets/covers/default_cover.png'
      },
      {
        id: 'pl_velvet',
        title: 'Velvet Hypnosis',
        curator: 'Sora & Kai',
        trackCount: 10,
        duration: '38 min',
        pinned: false,
        description: 'Futuristic synthesizer setups and purple lighting.',
        coverArt: 'assets/covers/default_cover.png'
      }
    ];

    this.deviceTracks = [];
    this.favorites = this.loadFavorites();
    this.history = this.loadHistory();
  }

  loadFavorites() {
    try {
      const data = localStorage.getItem(this.favoritesKey);
      return data ? JSON.parse(data) : ['waven_01', 'waven_02'];
    } catch (e) {
      return ['waven_01', 'waven_02'];
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem(this.favoritesKey, JSON.stringify(this.favorites));
    } catch (ignored) {}
  }

  isFavorite(trackId) {
    return this.favorites.includes(trackId);
  }

  toggleFavorite(trackId) {
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
    this.history = this.history.filter(t => t.id !== track.id);
    this.history.unshift(track);
    if (this.history.length > 50) this.history.pop();
    try {
      localStorage.setItem(this.historyKey, JSON.stringify(this.history));
    } catch (ignored) {}
  }

  getAllTracks() {
    return [...this.defaultTracks, ...this.deviceTracks];
  }

  getLikedTracks() {
    return this.getAllTracks().filter(t => this.isFavorite(t.id));
  }

  getPlaylists() {
    return this.playlists;
  }

  addScannedTracks(scannedJsonString) {
    try {
      const tracks = typeof scannedJsonString === 'string' ? JSON.parse(scannedJsonString) : scannedJsonString;
      if (Array.isArray(tracks)) {
        this.deviceTracks = tracks.map(t => ({
          ...t,
          duration: Math.round((t.duration || 0) / 1000),
          coverArt: t.coverArt || 'assets/covers/default_cover.png',
          hires: true
        }));
        console.log(`WAVEN Library updated: ${this.deviceTracks.length} local device tracks added.`);
      }
    } catch (e) {
      console.error('Failed to parse scanned audio tracks:', e);
    }
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
}

window.wavenLibrary = new LibraryManager();
