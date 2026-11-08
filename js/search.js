/**
 * WAVEN — ADVANCED MUSIC SEARCH MANAGER
 * Instant search across local audio files and curated catalog,
 * quick tags, suggestions, and glassmorphic track rendering.
 */

class SearchManager {
  constructor() {
    this.debounceTimer = null;
    this.currentQuery = "";
    this.currentFilter = "all"; // 'all' | 'tracks' | 'artists' | 'albums'
  }

  init() {
    const searchInputs = document.querySelectorAll(".search-input");
    const clearBtns = document.querySelectorAll(".search-clear-btn");

    searchInputs.forEach(input => {
      input.addEventListener("input", (e) => {
        const val = e.target.value;
        this.currentQuery = val;
        this.syncInputs(val);
        this.toggleClearButtons(val.length > 0);

        clearTimeout(this.debounceTimer);
        if (!val.trim()) {
          this.hideSuggestions();
          if (window.navigation && window.navigation.currentView === "search") {
            this.renderSearchLanding();
          }
          return;
        }

        this.debounceTimer = setTimeout(() => {
          this.renderSuggestions(val.trim());
          if (window.navigation && window.navigation.currentView === "search") {
            this.performSearch(val.trim());
          }
        }, 120);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          clearTimeout(this.debounceTimer);
          this.hideSuggestions();
          const val = e.target.value.trim();
          if (val) {
            window.navigation.navigateTo("search");
            this.performSearch(val);
          }
        } else if (e.key === "Escape") {
          this.hideSuggestions();
        }
      });

      input.addEventListener("focus", (e) => {
        const val = e.target.value.trim();
        if (val.length > 0) {
          this.renderSuggestions(val);
        }
      });
    });

    clearBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.currentQuery = "";
        this.syncInputs("");
        this.toggleClearButtons(false);
        this.hideSuggestions();
        if (window.navigation && window.navigation.currentView === "search") {
          this.renderSearchLanding();
        }
      });
    });

    // Close suggestions on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".waven-search-bar-wrap") && !e.target.closest("#search-suggestions-dropdown")) {
        this.hideSuggestions();
      }
    });

    this.renderSearchLanding();
  }

  syncInputs(val) {
    document.querySelectorAll(".search-input").forEach(inp => {
      if (inp.value !== val) inp.value = val;
    });
  }

  toggleClearButtons(show) {
    document.querySelectorAll(".search-clear-btn").forEach(btn => {
      btn.style.display = show ? "block" : "none";
    });
  }

  hideSuggestions() {
    const dropdown = document.getElementById("search-suggestions-dropdown");
    if (dropdown) dropdown.style.display = "none";
  }

  getAllSearchableTracks() {
    return window.storageService ? window.storageService.getAllTracks() : [];
  }

  renderSuggestions(query) {
    const dropdown = document.getElementById("search-suggestions-dropdown");
    if (!dropdown) return;

    const tracks = this.getAllSearchableTracks();
    const q = query.toLowerCase();

    const matchedTracks = tracks.filter(t =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.album && t.album.toLowerCase().includes(q))
    ).slice(0, 5);

    if (matchedTracks.length === 0) {
      this.hideSuggestions();
      return;
    }

    dropdown.innerHTML = `
      <div class="suggestions-header">Matching Songs (${matchedTracks.length})</div>
      ${matchedTracks.map(t => {
        const art = window.getTrackArtwork ? window.getTrackArtwork(t) : (t.artwork || 'assets/covers/default_cover.svg');
        return `
        <div class="suggestion-item" onclick="window.searchManager.handleSuggestionClick('${t.id}')">
          <img class="suggestion-art" src="${art}" alt="${t.title}" data-title="${t.title}" data-artist="${t.artist}" onerror="window.handleTrackImgError(this)" />
          <div class="suggestion-meta">
            <span class="suggestion-title">${t.title}</span>
            <span class="suggestion-artist">${t.artist}</span>
          </div>
          <span class="suggestion-dur">${t.durStr || (window.player ? window.player.formatTime(t.duration) : '3:30')}</span>
        </div>
      `}).join("")}
      <div class="suggestion-footer" onclick="window.navigation.navigateTo('search'); window.searchManager.performSearch('${query.replace(/'/g, "\\'")}'); window.searchManager.hideSuggestions();">
        Press Enter for full results
      </div>
    `;

    dropdown.style.display = "block";
  }

  handleSuggestionClick(trackId) {
    this.hideSuggestions();
    const track = window.WAVEN_CATALOG ? window.WAVEN_CATALOG.getTrack(trackId) : (window.storageService?.getTrackById(trackId));
    if (track && window.player) {
      window.player.playTrack(track);
    }
  }

  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll("#search-view .filter-pill").forEach(p => {
      if (p.getAttribute("data-filter") === filter) p.classList.add("active");
      else p.classList.remove("active");
    });
    if (this.currentQuery) {
      this.performSearch(this.currentQuery);
    } else {
      this.renderSearchLanding();
    }
  }

  quickSearch(term) {
    this.syncInputs(term);
    this.toggleClearButtons(true);
    this.hideSuggestions();
    this.performSearch(term);
  }

  performSearch(query) {
    this.currentQuery = query;
    const container = document.getElementById("search-results-area");
    if (!container) return;

    const allTracks = this.getAllSearchableTracks();
    const q = query.toLowerCase().trim();

    const matchedTracks = allTracks.filter(t =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.album && t.album.toLowerCase().includes(q)) ||
      (t.genre && t.genre.toLowerCase().includes(q))
    );

    // Group matching artists
    const artistMap = new Map();
    matchedTracks.forEach(t => {
      const art = t.artist || "Unknown Artist";
      if (!artistMap.has(art)) {
        artistMap.set(art, { name: art, tracks: [], artwork: t.artwork });
      }
      artistMap.get(art).tracks.push(t);
    });
    const matchedArtists = Array.from(artistMap.values());

    // Group matching albums
    const albumMap = new Map();
    matchedTracks.forEach(t => {
      const alb = t.album || "Single";
      if (!albumMap.has(alb)) {
        albumMap.set(alb, { name: alb, artist: t.artist, tracks: [], artwork: t.artwork });
      }
      albumMap.get(alb).tracks.push(t);
    });
    const matchedAlbums = Array.from(albumMap.values());

    if (matchedTracks.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box" style="margin-top: 36px; padding: 40px 20px; text-align: center;">
          <div class="empty-icon-wrap" style="margin: 0 auto 16px;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h2 class="empty-title" style="color: #fff; font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">No results found for "${query}"</h2>
          <p class="empty-desc" style="color: #8b92a4; font-size: 0.9rem; margin-bottom: 24px;">Check your spelling, try search tags below, or import audio files into your library.</p>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <button class="search-tag-chip" onclick="window.searchManager.quickSearch('Flowers')">Flowers</button>
            <button class="search-tag-chip" onclick="window.searchManager.quickSearch('Billie Eilish')">Billie Eilish</button>
            <button class="search-tag-chip" onclick="window.searchManager.quickSearch('Sabrina Carpenter')">Sabrina Carpenter</button>
            <button class="search-tag-chip" onclick="window.searchManager.quickSearch('Pop')">Pop</button>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div style="margin-bottom: 20px; margin-top: 8px;">
        <span style="font-size: 0.88rem; color: #8b92a4;">Found ${matchedTracks.length} song${matchedTracks.length === 1 ? '' : 's'} matching "${query}"</span>
      </div>
    `;

    // 1. Songs List (WAVEN tracklist card format)
    if (this.currentFilter === "all" || this.currentFilter === "tracks") {
      const currentTrackId = window.player?.state?.currentTrack?.id;
      html += `
        <div style="margin-bottom: 28px;">
          <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span>Songs</span>
            <span style="font-size: 0.78rem; color: #7b8394; font-weight: 500;">(${matchedTracks.length})</span>
          </div>
          <div class="waven-tracklist-card">
            ${matchedTracks.map(t => {
              const isPlayingThis = (currentTrackId === t.id);
              const isLiked = window.storageService ? window.storageService.isLiked(t.id) : false;
              const durText = t.durStr || (window.player ? window.player.formatTime(t.duration) : '3:30');
              const art = window.getTrackArtwork ? window.getTrackArtwork(t) : (t.artwork || 'assets/covers/default_cover.svg');
              return `
                <div class="waven-track-row ${isPlayingThis ? 'active-playing' : ''}" data-track-id="${t.id}" onclick="window.player.playTrack(window.WAVEN_CATALOG.getTrack('${t.id}'))">
                  <div class="track-thumb-circle">
                    <img src="${art}" alt="${t.title}" data-title="${t.title}" data-artist="${t.artist}" onerror="window.handleTrackImgError(this)" />
                    <div class="track-thumb-overlay-play">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </div>
                    <div class="track-row-equalizer">
                      <span class="eq-bar-sm"></span>
                      <span class="eq-bar-sm"></span>
                      <span class="eq-bar-sm"></span>
                    </div>
                  </div>
                  <div class="track-row-meta">
                    <span class="track-row-title">${t.title}</span>
                    <span class="track-row-artist">${t.artist}</span>
                  </div>
                  <span class="track-row-dur">${durText}</span>
                  <button class="track-row-heart-btn ${isLiked ? 'active' : ''}" title="Add to Favourites" onclick="event.stopPropagation(); window.app.toggleTrackFavourite('${t.id}', this)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#ef4444' : 'none'}" stroke="${isLiked ? '#ef4444' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  </button>
                  <button class="track-row-more-chip" title="Options" onclick="window.app.openContextMenu(event, '${t.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg>
                  </button>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    // 2. Matching Artists (Circular cards)
    if ((this.currentFilter === "all" || this.currentFilter === "artists") && matchedArtists.length > 0) {
      html += `
        <div style="margin-bottom: 28px;">
          <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 14px;">Artists</div>
          <div class="waven-artists-grid">
            ${matchedArtists.map(art => {
              const artSrc = (art.artwork && !art.artwork.includes('default_cover.svg')) ? art.artwork : (window.getTrackFallbackArtwork ? window.getTrackFallbackArtwork(art.name, "") : 'assets/covers/default_cover.svg');
              return `
              <div class="waven-artist-circle-card" onclick="window.navigation.navigateTo('artist', '${encodeURIComponent(art.name)}')">
                <div class="artist-circle-img-wrap">
                  <img src="${artSrc}" alt="${art.name}" data-title="${art.name}" data-artist="" onerror="window.handleTrackImgError(this)" />
                  <div class="artist-circle-play-overlay">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </div>
                </div>
                <span class="artist-circle-name">${art.name}</span>
                <span class="artist-circle-sub">${art.tracks.length} song${art.tracks.length === 1 ? '' : 's'}</span>
              </div>
            `}).join("")}
          </div>
        </div>
      `;
    }

    // 3. Matching Albums
    if ((this.currentFilter === "all" || this.currentFilter === "albums") && matchedAlbums.length > 0) {
      html += `
        <div style="margin-bottom: 28px;">
          <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 14px;">Albums</div>
          <div class="waven-albums-grid">
            ${matchedAlbums.map(al => {
              const alArt = (al.artwork && !al.artwork.includes('default_cover.svg')) ? al.artwork : (window.getTrackFallbackArtwork ? window.getTrackFallbackArtwork(al.name, al.artist) : 'assets/covers/default_cover.svg');
              return `
              <div class="waven-album-card" onclick="window.navigation.navigateTo('album', '${encodeURIComponent(al.name)}')">
                <div class="album-card-art-wrap">
                  <img src="${alArt}" alt="${al.name}" data-title="${al.name}" data-artist="${al.artist}" onerror="window.handleTrackImgError(this)" />
                  <div class="album-card-play-overlay">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </div>
                </div>
                <span class="album-card-title">${al.name}</span>
                <span class="album-card-artist">${al.artist}</span>
              </div>
            `}).join("")}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  renderSearchLanding() {
    const container = document.getElementById("search-results-area");
    if (!container) return;

    const allTracks = this.getAllSearchableTracks();
    const artists = window.WAVEN_CATALOG ? window.WAVEN_CATALOG.getArtists().slice(0, 5) : [];
    const currentTrackId = window.player?.state?.currentTrack?.id;

    if (allTracks.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box" style="margin-top: 40px; padding: 48px 20px; text-align: center;">
          <div class="empty-icon-wrap" style="margin: 0 auto 16px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h2 class="empty-title" style="color: #fff; font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">No Local Music Loaded</h2>
          <p class="empty-desc" style="color: #8b92a4; font-size: 0.9rem; margin-bottom: 24px; max-width: 440px; margin-left: auto; margin-right: auto;">
            Connect your device Music folder to search across your songs, artists, and albums.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn-primary" onclick="window.app.requestFolderAccess()" style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
              Select Music Folder
            </button>
            <button class="btn-secondary" onclick="window.app.requestFileAccess()" style="display: flex; align-items: center; gap: 8px;">
              Choose Audio Files
            </button>
          </div>
        </div>
      `;
      return;
    }

    const artistChips = artists.map(a => `<button class="search-tag-chip" onclick="window.searchManager.quickSearch('${a.name.replace(/'/g, "\\'")}')">${a.name}</button>`).join("");

    container.innerHTML = `
      <!-- Quick Tags -->
      <div style="margin-bottom: 24px;">
        <span style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #8b92a4; display: block; margin-bottom: 10px;">Quick Search</span>
        <div class="search-tags-row">
          ${artistChips || '<button class="search-tag-chip" onclick="window.searchManager.quickSearch(\'Local\')">Local Music</button>'}
        </div>
      </div>

      <!-- Top Artists Row -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <span style="font-size: 0.95rem; font-weight: 700; color: #fff;">Your Artists</span>
          <button style="font-size: 0.82rem; color: #8b92a4; cursor: pointer;" onclick="window.navigation.navigateTo('artists')">View all</button>
        </div>
        <div class="waven-artists-grid">
          ${artists.map(art => {
            const artSrc = (art.artwork && !art.artwork.includes('default_cover.svg')) ? art.artwork : (window.getTrackFallbackArtwork ? window.getTrackFallbackArtwork(art.name, "") : 'assets/covers/default_cover.svg');
            return `
            <div class="waven-artist-circle-card" onclick="window.navigation.navigateTo('artist', '${encodeURIComponent(art.name)}')">
              <div class="artist-circle-img-wrap">
                <img src="${artSrc}" alt="${art.name}" data-title="${art.name}" data-artist="" onerror="window.handleTrackImgError(this)" />
                <div class="artist-circle-play-overlay">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
              </div>
              <span class="artist-circle-name">${art.name}</span>
              <span class="artist-circle-sub">${art.tracks.length} song${art.tracks.length === 1 ? '' : 's'}</span>
            </div>
          `}).join("")}
        </div>
      </div>

      <!-- Songs from Library -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 0.95rem; font-weight: 700; color: #fff;">Songs from Your Library</span>
          <span style="font-size: 0.82rem; color: #7b8394;">Click to play</span>
        </div>
        <div class="waven-tracklist-card">
          ${allTracks.slice(0, 6).map(t => {
            const isPlayingThis = (currentTrackId === t.id);
            const isLiked = window.storageService ? window.storageService.isLiked(t.id) : false;
            const durText = t.durStr || (window.player ? window.player.formatTime(t.duration) : '0:00');
            const art = window.getTrackArtwork ? window.getTrackArtwork(t) : (t.artwork || 'assets/covers/default_cover.svg');
            return `
              <div class="waven-track-row ${isPlayingThis ? 'active-playing' : ''}" data-track-id="${t.id}" onclick="window.player.playTrack(window.storageService.getTrackById('${t.id}'), window.storageService.getAllTracks())">
                <div class="track-thumb-circle">
                  <img src="${art}" alt="${t.title}" data-title="${t.title}" data-artist="${t.artist}" onerror="window.handleTrackImgError(this)" />
                  <div class="track-thumb-overlay-play">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </div>
                  <div class="track-row-equalizer">
                    <span class="eq-bar-sm"></span>
                    <span class="eq-bar-sm"></span>
                    <span class="eq-bar-sm"></span>
                  </div>
                </div>
                <div class="track-row-meta">
                  <span class="track-row-title">${t.title}</span>
                  <span class="track-row-artist">${t.artist || 'Local Audio'}</span>
                </div>
                <span class="track-row-dur">${durText}</span>
                <button class="track-row-heart-btn ${isLiked ? 'active' : ''}" title="Add to Favourites" onclick="event.stopPropagation(); window.app.toggleTrackFavourite('${t.id}', this)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#ef4444' : 'none'}" stroke="${isLiked ? '#ef4444' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <button class="track-row-more-chip" title="Options" onclick="window.app.openContextMenu(event, '${t.id}')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg>
                </button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }
}

window.searchManager = new SearchManager();
