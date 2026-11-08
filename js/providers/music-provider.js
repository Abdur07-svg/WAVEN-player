/**
 * Music Provider Abstraction Layer & Normalized Data Models
 * Supports Audius, Apple/iTunes, and Curated Open Catalogs
 */

class NormalizedTrack {
  constructor(data) {
    this.id = String(data.id || "");
    this.provider = data.provider || "audius";
    this.title = (data.title || "Untitled").trim();
    this.artist = {
      id: String(data.artist?.id || data.artistId || ""),
      name: data.artist?.name || data.artistName || "Unknown Artist",
      handle: data.artist?.handle || "",
      avatar: data.artist?.avatar || data.artist?.imageUrl || ""
    };
    this.artistName = this.artist.name;
    this.artistId = this.artist.id;
    this.album = {
      id: String(data.album?.id || data.albumId || ""),
      title: data.album?.title || data.albumName || "Single",
      artwork: data.album?.artwork || data.artworkUrl || data.artwork || ""
    };
    this.albumName = this.album.title;
    this.albumId = this.album.id;
    this.artwork = data.artwork || data.artworkUrl || this.album.artwork || "assets/logo/logo.svg";
    this.artworkUrl = this.artwork;
    this.duration = Number(data.duration) || 0;
    this.releaseDate = data.releaseDate || "";
    this.streamUrl = data.streamUrl || data.previewUrl || "";
    this.previewUrl = data.previewUrl || this.streamUrl;
    this.externalUrl = data.externalUrl || data.permalink || "";
    this.explicit = Boolean(data.explicit);
    this.genre = data.genre || "Music";
    this.mood = data.mood || "";
    this.playCount = Number(data.playCount) || 0;
    this.availableForPlayback = data.availableForPlayback !== false;
    this.isStreamable = this.availableForPlayback;
    this.isPreviewOnly = Boolean(data.isPreviewOnly);
    this.source = this.provider;
    this.raw = data.raw || null;
  }
}

class NormalizedArtist {
  constructor(data) {
    this.id = String(data.id || "");
    this.provider = data.provider || "audius";
    this.name = data.name || "Artist";
    this.handle = data.handle || "";
    this.bio = data.bio || "";
    this.avatar = data.avatar || data.imageUrl || "assets/logo/logo.svg";
    this.imageUrl = this.avatar;
    this.coverPhoto = data.coverPhoto || "";
    this.genres = Array.isArray(data.genres) ? data.genres : (data.genre ? [data.genre] : []);
    this.followerCount = Number(data.followerCount) || 0;
    this.trackCount = Number(data.trackCount) || 0;
    this.popularity = Number(data.popularity) || 0;
    this.externalUrl = data.externalUrl || "";
  }
}

class NormalizedAlbum {
  constructor(data) {
    this.id = String(data.id || "");
    this.provider = data.provider || "audius";
    this.title = data.title || "Album";
    this.artist = {
      id: String(data.artist?.id || data.artistId || ""),
      name: data.artist?.name || data.artistName || "Artist"
    };
    this.artistName = this.artist.name;
    this.artistId = this.artist.id;
    this.artwork = data.artwork || data.artworkUrl || "assets/logo/logo.svg";
    this.artworkUrl = this.artwork;
    this.releaseDate = data.releaseDate || "";
    this.totalTracks = Number(data.totalTracks) || (data.tracks ? data.tracks.length : 0);
    this.tracks = Array.isArray(data.tracks) ? data.tracks : [];
    this.genre = data.genre || "Music";
    this.externalUrl = data.externalUrl || "";
  }
}

class BaseMusicProvider {
  constructor(name) {
    this.name = name;
    this.status = "ready";
    this.latency = 0;
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.lastSuccessfulRequest = Date.now();
  }

  async searchTracks(query, options = {}, signal = null) { throw new Error("searchTracks not implemented"); }
  async searchArtists(query, options = {}, signal = null) { throw new Error("searchArtists not implemented"); }
  async searchAlbums(query, options = {}, signal = null) { throw new Error("searchAlbums not implemented"); }
  async getTrack(id) { throw new Error("getTrack not implemented"); }
  async getArtist(id) { throw new Error("getArtist not implemented"); }
  async getAlbum(id) { throw new Error("getAlbum not implemented"); }
  async getRecommendations(seedTrack, options = {}) { throw new Error("getRecommendations not implemented"); }
  async getPlaybackInfo(id) { throw new Error("getPlaybackInfo not implemented"); }

  _recordSuccess(startMs) {
    this.totalRequests++;
    this.latency = Math.max(1, Math.round(performance.now() - startMs));
    this.status = "operational";
    this.lastSuccessfulRequest = Date.now();
  }

  _recordError(err) {
    this.totalRequests++;
    this.totalErrors++;
    this.status = this.totalErrors > 5 ? "degraded" : "operational";
  }
}

class AudiusProvider extends BaseMusicProvider {
  constructor() {
    super("audius");
    this.service = window.audiusService || null;
  }

  getService() {
    return this.service || window.audiusService;
  }

  async searchTracks(query, options = {}, signal = null) {
    const start = performance.now();
    try {
      const svc = this.getService();
      if (!svc) return [];
      const rawTracks = await svc.searchTracks(query, options, signal);
      this._recordSuccess(start);
      return (rawTracks || []).map(t => new NormalizedTrack({
        id: t.id,
        provider: "audius",
        title: t.title,
        artist: t.artist,
        artwork: t.artwork,
        duration: t.duration,
        genre: t.genre,
        mood: t.mood,
        releaseDate: t.releaseDate,
        playCount: t.playCount,
        streamUrl: svc.getStreamUrl(t.id),
        previewUrl: svc.getStreamUrl(t.id),
        externalUrl: t.permalink || `https://audius.co`,
        availableForPlayback: t.isStreamable !== false,
        isPreviewOnly: false,
        raw: t.raw
      }));
    } catch (err) {
      if (err.name !== 'AbortError') this._recordError(err);
      throw err;
    }
  }

  async searchArtists(query, options = {}, signal = null) {
    const start = performance.now();
    try {
      const svc = this.getService();
      if (!svc) return [];
      const rawArtists = await svc.searchArtists(query, options, signal);
      this._recordSuccess(start);
      return (rawArtists || []).map(a => new NormalizedArtist({
        id: a.id,
        provider: "audius",
        name: a.name,
        handle: a.handle,
        bio: a.bio,
        avatar: a.avatar,
        followerCount: a.followerCount,
        trackCount: a.trackCount,
        externalUrl: a.handle ? `https://audius.co/${a.handle}` : ""
      }));
    } catch (err) {
      if (err.name !== 'AbortError') this._recordError(err);
      throw err;
    }
  }

  async searchAlbums(query, options = {}, signal = null) {
    // Audius playlists / albums search
    const tracks = await this.searchTracks(query, { limit: 12 }, signal);
    const albumsMap = new Map();
    tracks.forEach(t => {
      const albName = t.albumName || `${t.artistName} Collection`;
      if (!albumsMap.has(albName)) {
        albumsMap.set(albName, new NormalizedAlbum({
          id: `alb_aud_${t.id}`,
          provider: "audius",
          title: albName,
          artist: t.artist,
          artwork: t.artwork,
          releaseDate: t.releaseDate || "2024",
          totalTracks: 1,
          tracks: [t],
          genre: t.genre,
          externalUrl: t.externalUrl
        }));
      } else {
        const exist = albumsMap.get(albName);
        exist.tracks.push(t);
        exist.totalTracks = exist.tracks.length;
      }
    });
    return Array.from(albumsMap.values());
  }

  async getTrack(id) {
    const svc = this.getService();
    if (!svc) return null;
    try {
      const raw = await svc._get(`/v1/tracks/${id}`);
      if (!raw) return null;
      const t = svc.normalizeTrack(raw);
      return new NormalizedTrack({
        id: t.id,
        provider: "audius",
        title: t.title,
        artist: t.artist,
        artwork: t.artwork,
        duration: t.duration,
        genre: t.genre,
        streamUrl: svc.getStreamUrl(t.id),
        previewUrl: svc.getStreamUrl(t.id),
        externalUrl: t.permalink || "https://audius.co",
        availableForPlayback: t.isStreamable !== false,
        raw: t.raw
      });
    } catch (e) {
      return null;
    }
  }

  async getArtist(id) {
    const svc = this.getService();
    if (!svc) return null;
    const raw = await svc.getArtist(id);
    if (!raw) return null;
    return new NormalizedArtist({
      id: raw.id,
      provider: "audius",
      name: raw.name,
      handle: raw.handle,
      bio: raw.bio,
      avatar: raw.avatar,
      coverPhoto: raw.coverPhoto,
      followerCount: raw.followerCount,
      trackCount: raw.trackCount,
      externalUrl: raw.handle ? `https://audius.co/${raw.handle}` : ""
    });
  }

  async getArtistTracks(id, limit = 30) {
    const svc = this.getService();
    if (!svc) return [];
    const tracks = await svc.getArtistTracks(id, limit);
    return (tracks || []).map(t => new NormalizedTrack({
      id: t.id,
      provider: "audius",
      title: t.title,
      artist: t.artist,
      artwork: t.artwork,
      duration: t.duration,
      genre: t.genre,
      streamUrl: svc.getStreamUrl(t.id),
      previewUrl: svc.getStreamUrl(t.id),
      externalUrl: t.permalink || "https://audius.co",
      availableForPlayback: t.isStreamable !== false
    }));
  }

  async getTrending(genre = "", time = "week", limit = 30) {
    const svc = this.getService();
    if (!svc) return [];
    const tracks = await svc.getTrending(genre, time, limit);
    return (tracks || []).map(t => new NormalizedTrack({
      id: t.id,
      provider: "audius",
      title: t.title,
      artist: t.artist,
      artwork: t.artwork,
      duration: t.duration,
      genre: t.genre,
      streamUrl: svc.getStreamUrl(t.id),
      previewUrl: svc.getStreamUrl(t.id),
      externalUrl: t.permalink || "https://audius.co",
      availableForPlayback: t.isStreamable !== false
    }));
  }

  async getUnderground(limit = 20) {
    const svc = this.getService();
    if (!svc) return [];
    const tracks = await svc.getUndergroundTrending(limit);
    return (tracks || []).map(t => new NormalizedTrack({
      id: t.id,
      provider: "audius",
      title: t.title,
      artist: t.artist,
      artwork: t.artwork,
      duration: t.duration,
      genre: t.genre,
      streamUrl: svc.getStreamUrl(t.id),
      previewUrl: svc.getStreamUrl(t.id),
      externalUrl: t.permalink || "https://audius.co",
      availableForPlayback: t.isStreamable !== false
    }));
  }

  async getRecommendations(seedTrack, options = {}) {
    const genre = seedTrack?.genre || "Electronic";
    return this.getTrending(genre, "month", options.limit || 10);
  }
}

class ITunesProvider extends BaseMusicProvider {
  constructor() {
    super("itunes");
    this.baseUrl = "https://itunes.apple.com/search";
    this.cache = new Map();
  }

  async searchTracks(query, options = {}, signal = null) {
    const start = performance.now();
    try {
      const limit = options.limit || 25;
      const url = `${this.baseUrl}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`iTunes API error ${res.status}`);
      const data = await res.json();
      this._recordSuccess(start);

      return (data.results || []).map(item => {
        const artworkHighRes = item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : "";
        return new NormalizedTrack({
          id: `itunes_${item.trackId}`,
          provider: "itunes",
          title: item.trackName || "Untitled",
          artist: {
            id: `itunes_art_${item.artistId}`,
            name: item.artistName || "Unknown Artist",
            handle: item.artistName?.toLowerCase().replace(/\s+/g, '') || ""
          },
          album: {
            id: `itunes_alb_${item.collectionId}`,
            title: item.collectionName || item.trackName || "Single",
            artwork: artworkHighRes
          },
          artwork: artworkHighRes,
          duration: Math.round((item.trackTimeMillis || 30000) / 1000),
          releaseDate: item.releaseDate ? item.releaseDate.split("T")[0] : "",
          streamUrl: item.previewUrl || "",
          previewUrl: item.previewUrl || "",
          externalUrl: item.trackViewUrl || item.collectionViewUrl || item.artistViewUrl || "https://music.apple.com",
          explicit: item.trackExplicitness === "explicit",
          genre: item.primaryGenreName || "Pop",
          availableForPlayback: Boolean(item.previewUrl),
          isPreviewOnly: true,
          raw: item
        });
      });
    } catch (err) {
      if (err.name !== 'AbortError') this._recordError(err);
      throw err;
    }
  }

  async searchArtists(query, options = {}, signal = null) {
    const start = performance.now();
    try {
      const limit = options.limit || 10;
      const url = `${this.baseUrl}?term=${encodeURIComponent(query)}&media=music&entity=musicArtist&limit=${limit}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`iTunes API error ${res.status}`);
      const data = await res.json();
      this._recordSuccess(start);

      return (data.results || []).map(item => new NormalizedArtist({
        id: `itunes_art_${item.artistId}`,
        provider: "itunes",
        name: item.artistName,
        handle: item.artistName?.toLowerCase().replace(/\s+/g, ''),
        genres: item.primaryGenreName ? [item.primaryGenreName] : [],
        externalUrl: item.artistLinkUrl || "https://music.apple.com",
        avatar: ""
      }));
    } catch (err) {
      if (err.name !== 'AbortError') this._recordError(err);
      throw err;
    }
  }

  async searchAlbums(query, options = {}, signal = null) {
    const start = performance.now();
    try {
      const limit = options.limit || 12;
      const url = `${this.baseUrl}?term=${encodeURIComponent(query)}&media=music&entity=album&limit=${limit}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`iTunes API error ${res.status}`);
      const data = await res.json();
      this._recordSuccess(start);

      return (data.results || []).map(item => {
        const artworkHighRes = item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : "";
        return new NormalizedAlbum({
          id: `itunes_alb_${item.collectionId}`,
          provider: "itunes",
          title: item.collectionName,
          artist: {
            id: `itunes_art_${item.artistId}`,
            name: item.artistName
          },
          artwork: artworkHighRes,
          releaseDate: item.releaseDate ? item.releaseDate.split("T")[0] : "",
          totalTracks: item.trackCount || 1,
          genre: item.primaryGenreName || "Music",
          externalUrl: item.collectionViewUrl || "https://music.apple.com"
        });
      });
    } catch (err) {
      if (err.name !== 'AbortError') this._recordError(err);
      throw err;
    }
  }

  async getAlbum(collectionId) {
    const cleanId = String(collectionId).replace("itunes_alb_", "");
    try {
      const url = `https://itunes.apple.com/lookup?id=${cleanId}&entity=song`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.results || data.results.length === 0) return null;

      const albumMeta = data.results[0];
      const trackItems = data.results.slice(1);
      const artworkHighRes = albumMeta.artworkUrl100 ? albumMeta.artworkUrl100.replace("100x100bb", "600x600bb") : "";

      const tracks = trackItems.map(item => new NormalizedTrack({
        id: `itunes_${item.trackId}`,
        provider: "itunes",
        title: item.trackName || "Track",
        artist: {
          id: `itunes_art_${item.artistId}`,
          name: item.artistName || albumMeta.artistName
        },
        album: {
          id: `itunes_alb_${albumMeta.collectionId}`,
          title: albumMeta.collectionName,
          artwork: artworkHighRes
        },
        artwork: artworkHighRes,
        duration: Math.round((item.trackTimeMillis || 30000) / 1000),
        releaseDate: item.releaseDate ? item.releaseDate.split("T")[0] : albumMeta.releaseDate?.split("T")[0],
        streamUrl: item.previewUrl || "",
        previewUrl: item.previewUrl || "",
        externalUrl: item.trackViewUrl || albumMeta.collectionViewUrl || "https://music.apple.com",
        explicit: item.trackExplicitness === "explicit",
        genre: item.primaryGenreName || albumMeta.primaryGenreName || "Music",
        availableForPlayback: Boolean(item.previewUrl),
        isPreviewOnly: true
      }));

      return new NormalizedAlbum({
        id: `itunes_alb_${albumMeta.collectionId}`,
        provider: "itunes",
        title: albumMeta.collectionName,
        artist: {
          id: `itunes_art_${albumMeta.artistId}`,
          name: albumMeta.artistName
        },
        artwork: artworkHighRes,
        releaseDate: albumMeta.releaseDate ? albumMeta.releaseDate.split("T")[0] : "",
        totalTracks: albumMeta.trackCount || tracks.length,
        tracks: tracks,
        genre: albumMeta.primaryGenreName || "Music",
        externalUrl: albumMeta.collectionViewUrl || "https://music.apple.com"
      });
    } catch (e) {
      console.warn("iTunes getAlbum lookup error:", e);
      return null;
    }
  }

  async getArtist(artistId) {
    const cleanId = String(artistId).replace("itunes_art_", "");
    try {
      const url = `https://itunes.apple.com/lookup?id=${cleanId}&entity=song&limit=25`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.results || data.results.length === 0) return null;

      const artistMeta = data.results[0];
      const trackItems = data.results.slice(1);
      const firstArtwork = trackItems.length > 0 && trackItems[0].artworkUrl100
        ? trackItems[0].artworkUrl100.replace("100x100bb", "600x600bb")
        : "";

      return new NormalizedArtist({
        id: `itunes_art_${artistMeta.artistId}`,
        provider: "itunes",
        name: artistMeta.artistName,
        handle: artistMeta.artistName?.toLowerCase().replace(/\s+/g, ''),
        genres: artistMeta.primaryGenreName ? [artistMeta.primaryGenreName] : [],
        avatar: firstArtwork,
        externalUrl: artistMeta.artistLinkUrl || "https://music.apple.com"
      });
    } catch (e) {
      return null;
    }
  }
}

class CuratedCatalogProvider extends BaseMusicProvider {
  constructor() {
    super("curated");
    this.curatedTracks = [
      {
        id: "cur_01",
        title: "Midnight City Lights",
        artistName: "Aether Void",
        artistId: "art_aether",
        albumName: "Neon Horizons",
        albumId: "alb_neon",
        artwork: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        duration: 198,
        genre: "Electronic",
        streamUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
        releaseDate: "2024-04-12",
        externalUrl: "https://pixabay.com/music/"
      },
      {
        id: "cur_02",
        title: "Sunset Boulevard Dream",
        artistName: "Lunar Waves",
        artistId: "art_lunar",
        albumName: "Endless Summer",
        albumId: "alb_summer",
        artwork: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
        duration: 215,
        genre: "Lo-Fi",
        streamUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=electronic-future-beats-117997.mp3",
        releaseDate: "2024-05-01",
        externalUrl: "https://pixabay.com/music/"
      },
      {
        id: "cur_03",
        title: "Cyberpunk Odyssey",
        artistName: "Synthetix",
        artistId: "art_synthetix",
        albumName: "Retrograde 2099",
        albumId: "alb_retro",
        artwork: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80",
        duration: 240,
        genre: "Synthwave",
        streamUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=tomp3cc_synthwave-80s-retro-109267.mp3",
        releaseDate: "2024-03-20",
        externalUrl: "https://pixabay.com/music/"
      },
      {
        id: "cur_04",
        title: "Rainy Afternoon in Tokyo",
        artistName: "Kuro Neko",
        artistId: "art_kuro",
        albumName: "Coffee & Rain",
        albumId: "alb_coffee",
        artwork: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
        duration: 172,
        genre: "Lo-Fi",
        streamUrl: "https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=chill-abstract-intention-12099.mp3",
        releaseDate: "2024-06-10",
        externalUrl: "https://pixabay.com/music/"
      },
      {
        id: "cur_05",
        title: "Golden Hour Vibes",
        artistName: "Solstice",
        artistId: "art_solstice",
        albumName: "Warm Horizons",
        albumId: "alb_warm",
        artwork: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80",
        duration: 184,
        genre: "Ambient",
        streamUrl: "https://cdn.pixabay.com/download/audio/2022/08/02/audio_884fe92c21.mp3?filename=relaxed-vlog-131746.mp3",
        releaseDate: "2024-07-01",
        externalUrl: "https://pixabay.com/music/"
      },
      {
        id: "cur_06",
        title: "Deep House Echoes",
        artistName: "DJ Pulse",
        artistId: "art_pulse",
        albumName: "Club Sessions Vol 1",
        albumId: "alb_club",
        artwork: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
        duration: 260,
        genre: "House",
        streamUrl: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3?filename=the-cradle-of-your-soul-15700.mp3",
        releaseDate: "2024-02-18",
        externalUrl: "https://pixabay.com/music/"
      }
    ];
  }

  async searchTracks(query, options = {}) {
    const q = query.toLowerCase();
    const filtered = this.curatedTracks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artistName.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q)
    );
    return (filtered.length > 0 ? filtered : this.curatedTracks).map(t => new NormalizedTrack({
      id: t.id,
      provider: "curated",
      title: t.title,
      artist: { id: t.artistId, name: t.artistName },
      album: { id: t.albumId, title: t.albumName, artwork: t.artwork },
      artwork: t.artwork,
      duration: t.duration,
      genre: t.genre,
      streamUrl: t.streamUrl,
      previewUrl: t.streamUrl,
      releaseDate: t.releaseDate,
      externalUrl: t.externalUrl,
      availableForPlayback: true
    }));
  }

  async getCuratedList() {
    return this.curatedTracks.map(t => new NormalizedTrack({
      id: t.id,
      provider: "curated",
      title: t.title,
      artist: { id: t.artistId, name: t.artistName },
      album: { id: t.albumId, title: t.albumName, artwork: t.artwork },
      artwork: t.artwork,
      duration: t.duration,
      genre: t.genre,
      streamUrl: t.streamUrl,
      previewUrl: t.streamUrl,
      releaseDate: t.releaseDate,
      externalUrl: t.externalUrl,
      availableForPlayback: true
    }));
  }
}

class ProviderManager {
  constructor() {
    this.providers = {
      audius: new AudiusProvider(),
      itunes: new ITunesProvider(),
      curated: new CuratedCatalogProvider()
    };
    this.activeProviderName = "all"; // 'all' | 'audius' | 'itunes' | 'curated'
  }

  getProvider(name) {
    return this.providers[name] || this.providers.audius;
  }

  getActiveProvider() {
    if (this.activeProviderName === "all") return this.providers.audius;
    return this.providers[this.activeProviderName] || this.providers.audius;
  }

  setProvider(name) {
    if (name === "all" || this.providers[name]) {
      this.activeProviderName = name;
      window.dispatchEvent(new CustomEvent("ar7:provider_changed", { detail: { provider: name } }));
    }
  }

  async searchMultiProvider(query, filterType = "all", options = {}, signal = null) {
    const results = {
      tracks: [],
      artists: [],
      albums: []
    };

    if (!query || !query.trim()) return results;

    const audius = this.providers.audius;
    const itunes = this.providers.itunes;
    const curated = this.providers.curated;

    const fetchPromises = [];

    // Audius Search
    if (this.activeProviderName === "all" || this.activeProviderName === "audius") {
      if (filterType === "all" || filterType === "tracks") {
        fetchPromises.push(audius.searchTracks(query, { limit: 16 }, signal).catch(() => []));
      } else {
        fetchPromises.push(Promise.resolve([]));
      }

      if (filterType === "all" || filterType === "artists") {
        fetchPromises.push(audius.searchArtists(query, { limit: 8 }, signal).catch(() => []));
      } else {
        fetchPromises.push(Promise.resolve([]));
      }

      if (filterType === "all" || filterType === "albums") {
        fetchPromises.push(audius.searchAlbums(query, { limit: 8 }, signal).catch(() => []));
      } else {
        fetchPromises.push(Promise.resolve([]));
      }
    } else {
      fetchPromises.push(Promise.resolve([]), Promise.resolve([]), Promise.resolve([]));
    }

    // iTunes / Apple Search (Rich preview catalog for chart toppers, Bollywood, Pop, etc.)
    if (this.activeProviderName === "all" || this.activeProviderName === "itunes") {
      if (filterType === "all" || filterType === "tracks") {
        fetchPromises.push(itunes.searchTracks(query, { limit: 16 }, signal).catch(() => []));
      } else {
        fetchPromises.push(Promise.resolve([]));
      }

      if (filterType === "all" || filterType === "artists") {
        fetchPromises.push(itunes.searchArtists(query, { limit: 8 }, signal).catch(() => []));
      } else {
        fetchPromises.push(Promise.resolve([]));
      }

      if (filterType === "all" || filterType === "albums") {
        fetchPromises.push(itunes.searchAlbums(query, { limit: 8 }, signal).catch(() => []));
      } else {
        fetchPromises.push(Promise.resolve([]));
      }
    } else {
      fetchPromises.push(Promise.resolve([]), Promise.resolve([]), Promise.resolve([]));
    }

    try {
      const [audTracks, audArtists, audAlbums, itTracks, itArtists, itAlbums] = await Promise.all(fetchPromises);

      // Merge and deduplicate
      const trackMap = new Map();
      [...(audTracks || []), ...(itTracks || [])].forEach(t => {
        if (!trackMap.has(t.id)) trackMap.set(t.id, t);
      });

      const artistMap = new Map();
      [...(audArtists || []), ...(itArtists || [])].forEach(a => {
        if (!artistMap.has(a.id)) artistMap.set(a.id, a);
      });

      const albumMap = new Map();
      [...(audAlbums || []), ...(itAlbums || [])].forEach(alb => {
        if (!albumMap.has(alb.id)) albumMap.set(alb.id, alb);
      });

      results.tracks = Array.from(trackMap.values());
      results.artists = Array.from(artistMap.values());
      results.albums = Array.from(albumMap.values());

      // If online search returned empty, fall back to curated open catalog
      if (results.tracks.length === 0 && results.artists.length === 0) {
        const curTracks = await curated.searchTracks(query);
        results.tracks = curTracks;
      }

      return results;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn("Multi-provider search error:", err);
      results.tracks = await curated.searchTracks(query);
      return results;
    }
  }

  getHealthStats() {
    return Object.entries(this.providers).map(([key, provider]) => ({
      name: key,
      status: provider.status,
      latency: provider.latency,
      totalRequests: provider.totalRequests,
      totalErrors: provider.totalErrors,
      lastSuccessfulRequest: provider.lastSuccessfulRequest
    }));
  }
}

window.NormalizedTrack = NormalizedTrack;
window.NormalizedArtist = NormalizedArtist;
window.NormalizedAlbum = NormalizedAlbum;
window.providerManager = new ProviderManager();
