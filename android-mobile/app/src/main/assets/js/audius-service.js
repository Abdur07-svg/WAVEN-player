/**
 * AR7 MUSIC — AUDIUS OFFICIAL API SERVICE LAYER
 * Connects directly to Audius Decentralized Discovery Nodes for real music metadata & audio streams.
 */

class AudiusService {
  constructor() {
    this.appName = window.CONFIG?.APP_NAME || "AR7Music";
    this.apiKey = window.CONFIG?.AUDIUS_API_KEY || "";
    this.activeHost = null;
    this.candidateHosts = [...(window.CONFIG?.DEFAULT_DISCOVERY_NODES || [
      "https://discoveryprovider.audius.co",
      "https://audius-discovery-1.cultur3stake.com",
      "https://audius-dp.amsterdam.creatorseed.com",
      "https://dn1.monophonic.digital"
    ])];
    this.isInitialized = false;
    this.initPromise = null;

    // Cache with TTL (5 minutes)
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000;
  }

  /**
   * Initializes and finds a live, responsive Audius discovery node.
   */
  async init() {
    if (this.isInitialized && this.activeHost) {
      return this.activeHost;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // First try fetching official list of healthy nodes from Audius root dispatcher
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch("https://api.audius.co", {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          if (json && Array.isArray(json.data) && json.data.length > 0) {
            this.candidateHosts = json.data;
          }
        }
      } catch (err) {
        console.warn("Could not fetch node list from api.audius.co, using default candidate hosts.", err);
      }

      // Test candidate hosts to find a responsive one
      for (const host of this.candidateHosts) {
        try {
          const testCtrl = new AbortController();
          const testTimeout = setTimeout(() => testCtrl.abort(), 3500);
          const res = await fetch(`${host}/v1/tracks/trending?app_name=${this.appName}&limit=1`, {
            signal: testCtrl.signal
          });
          clearTimeout(testTimeout);

          if (res.ok) {
            this.activeHost = host;
            this.isInitialized = true;
            console.log("Connected to Audius Discovery Node:", host);
            window.dispatchEvent(new CustomEvent("ar7:api_connected", { detail: { host } }));
            return host;
          }
        } catch (e) {
          // Continue to next node
        }
      }

      // Default fallback
      this.activeHost = this.candidateHosts[0] || "https://discoveryprovider.audius.co";
      this.isInitialized = true;
      return this.activeHost;
    })();

    return this.initPromise;
  }

  /**
   * Executes a GET request with caching, timeout, and failover
   */
  async _get(endpoint, params = {}, abortSignal = null) {
    await this.init();

    // Build URL query string
    const urlParams = new URLSearchParams({
      app_name: this.appName,
      ...params
    });

    if (this.apiKey) {
      urlParams.append("api_key", this.apiKey);
    }

    const cacheKey = `${endpoint}?${urlParams.toString()}`;

    // Check memory cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    const requestUrl = `${this.activeHost}${endpoint}?${urlParams.toString()}`;

    try {
      const res = await fetch(requestUrl, {
        headers: {
          'Accept': 'application/json'
        },
        signal: abortSignal
      });

      if (!res.ok) {
        throw new Error(`Audius API Error ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      const resultData = json.data;

      // Save to cache
      this.cache.set(cacheKey, {
        data: resultData,
        timestamp: Date.now()
      });

      return resultData;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw err; // Forward abort
      }

      console.warn(`Request failed on ${this.activeHost}, trying failover...`, err);

      // Attempt single failover to alternative host
      const altHost = this.candidateHosts.find(h => h !== this.activeHost) || "https://discoveryprovider.audius.co";
      if (altHost !== this.activeHost) {
        this.activeHost = altHost;
        const retryUrl = `${this.activeHost}${endpoint}?${urlParams.toString()}`;
        const retryRes = await fetch(retryUrl, { signal: abortSignal });
        if (retryRes.ok) {
          const retryJson = await retryRes.json();
          return retryJson.data;
        }
      }
      throw err;
    }
  }

  /**
   * Normalizes raw Audius track object to standard AR7 track model
   */
  normalizeTrack(raw) {
    if (!raw) return null;

    // Artwork resolutions
    let artwork = "";
    if (raw.artwork) {
      artwork = raw.artwork['480x480'] || raw.artwork['1000x1000'] || raw.artwork['150x150'] || Object.values(raw.artwork)[0] || "";
    }

    // Artist info
    const artist = {
      id: raw.user?.id || raw.userId || "",
      name: raw.user?.name || raw.user?.handle || "Unknown Artist",
      handle: raw.user?.handle || "",
      avatar: raw.user?.profile_picture ? (raw.user.profile_picture['480x480'] || Object.values(raw.user.profile_picture)[0]) : ""
    };

    const isStreamable = raw.is_streamable !== false && raw.is_downloadable !== false;

    return {
      id: raw.id,
      title: (raw.title || "Untitled").trim(),
      artist: artist,
      artwork: artwork,
      duration: raw.duration || 0,
      genre: raw.genre || "Music",
      mood: raw.mood || "",
      releaseDate: raw.release_date || "",
      playCount: raw.play_count || 0,
      permalink: raw.permalink ? `https://audius.co${raw.permalink}` : "",
      source: "audius",
      isStreamable: isStreamable,
      raw: raw
    };
  }

  /**
   * Search Tracks
   */
  async searchTracks(query, options = {}, abortSignal = null) {
    if (!query || !query.trim()) return [];
    try {
      const data = await this._get("/v1/tracks/search", {
        query: query.trim(),
        limit: options.limit || 25,
        offset: options.offset || 0
      }, abortSignal);

      return Array.isArray(data) ? data.map(t => this.normalizeTrack(t)).filter(Boolean) : [];
    } catch (err) {
      if (err.name === 'AbortError') return [];
      console.error("Audius searchTracks error:", err);
      return [];
    }
  }

  /**
   * Search Artists / Users
   */
  async searchArtists(query, options = {}, abortSignal = null) {
    if (!query || !query.trim()) return [];
    try {
      const data = await this._get("/v1/users/search", {
        query: query.trim(),
        limit: options.limit || 12
      }, abortSignal);

      return Array.isArray(data) ? data.map(user => ({
        id: user.id,
        name: user.name || user.handle || "Artist",
        handle: user.handle,
        bio: user.bio || "",
        avatar: user.profile_picture ? (user.profile_picture['480x480'] || Object.values(user.profile_picture)[0]) : "",
        followerCount: user.follower_count || 0,
        trackCount: user.track_count || 0
      })) : [];
    } catch (err) {
      if (err.name === 'AbortError') return [];
      console.error("Audius searchArtists error:", err);
      return [];
    }
  }

  /**
   * Get Trending Tracks
   */
  async getTrending(genre = "", time = "week", limit = 30) {
    try {
      const params = {
        limit: limit,
        time: time
      };
      if (genre && genre.toLowerCase() !== "all") {
        params.genre = genre;
      }

      const data = await this._get("/v1/tracks/trending", params);
      return Array.isArray(data) ? data.map(t => this.normalizeTrack(t)).filter(Boolean) : [];
    } catch (err) {
      console.error("Audius getTrending error:", err);
      return [];
    }
  }

  /**
   * Get Underground Trending Tracks
   */
  async getUndergroundTrending(limit = 20) {
    try {
      const data = await this._get("/v1/tracks/trending/underground", { limit });
      return Array.isArray(data) ? data.map(t => this.normalizeTrack(t)).filter(Boolean) : [];
    } catch (err) {
      console.error("Audius getUndergroundTrending error:", err);
      return [];
    }
  }

  /**
   * Get Artist Tracks
   */
  async getArtistTracks(userId, limit = 30) {
    if (!userId) return [];
    try {
      const data = await this._get(`/v1/users/${userId}/tracks`, { limit });
      return Array.isArray(data) ? data.map(t => this.normalizeTrack(t)).filter(Boolean) : [];
    } catch (err) {
      console.error("Audius getArtistTracks error:", err);
      return [];
    }
  }

  /**
   * Get Artist Profile by ID
   */
  async getArtist(userId) {
    if (!userId) return null;
    try {
      const user = await this._get(`/v1/users/${userId}`);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name || user.handle || "Artist",
        handle: user.handle,
        bio: user.bio || "",
        avatar: user.profile_picture ? (user.profile_picture['480x480'] || Object.values(user.profile_picture)[0]) : "",
        coverPhoto: user.cover_photo ? (user.cover_photo['2000x'] || user.cover_photo['640x'] || Object.values(user.cover_photo)[0]) : "",
        followerCount: user.follower_count || 0,
        trackCount: user.track_count || 0
      };
    } catch (err) {
      console.error("Audius getArtist error:", err);
      return null;
    }
  }

  /**
   * Generate Direct Audio Stream URL for Track
   */
  getStreamUrl(trackId) {
    if (!trackId) return "";
    const host = this.activeHost || "https://discoveryprovider.audius.co";
    let url = `${host}/v1/tracks/${trackId}/stream?app_name=${this.appName}`;
    if (this.apiKey) {
      url += `&api_key=${this.apiKey}`;
    }
    return url;
  }
}

// Global Audius Service instance
window.audiusService = new AudiusService();
