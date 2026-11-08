/**
 * WAVEN — LOCAL & CATALOG LIBRARY MANAGER
 * Controls All Songs, Albums, Artists, Genres, Favourites, sorting,
 * and luxury glassmorphic card grids.
 */

class LibraryManager {
  constructor() {
    this.currentSortField = "addedAt";
    this.currentSortOrder = "desc";
    this.selectedGenre = null;
  }

  init() {
    const settings = window.storageService ? window.storageService.getSettings() : {};
    if (settings.sortField) this.currentSortField = settings.sortField;
    if (settings.sortOrder) this.currentSortOrder = settings.sortOrder;

    window.addEventListener("ar7:library_updated", () => {
      this.refreshCurrentView();
    });

    window.addEventListener("ar7:liked_updated", () => {
      if (window.navigation && window.navigation.currentView === "liked") {
        this.renderLikedSongsView();
      }
      if (window.navigation && window.navigation.currentView === "library") {
        this.renderLibraryView();
      }
    });

    window.addEventListener("ar7:player_state_changed", () => {
      this.updatePlayingRowIndicators();
    });
  }

  refreshCurrentView() {
    if (!window.navigation) return;
    const view = window.navigation.currentView;
    if (view === "library") this.renderLibraryView();
    else if (view === "albums") this.renderAlbumsView();
    else if (view === "artists") this.renderArtistsView();
    else if (view === "genres") this.renderGenresView();
    else if (view === "liked") this.renderLikedSongsView();
    else if (view === "album") this.renderAlbumDetails(window.navigation.currentParam);
    else if (view === "artist") this.renderArtistDetails(window.navigation.currentParam);
    else if (view === "home" && window.app) window.app.loadHomeFeeds();
  }

  getAllAvailableTracks() {
    return window.storageService ? window.storageService.getAllTracks() : [];
  }

  // -------------------------------------------------------------
  // ALL SONGS / LIBRARY VIEW
  // -------------------------------------------------------------

  renderLibraryView() {
    const container = document.getElementById("library-view-content");
    if (!container) return;

    let tracks = this.getAllAvailableTracks();
    const totalCount = tracks.length;

    if (totalCount === 0) {
      container.innerHTML = `
        <div class="waven-view-header">
          <h1 class="view-main-title">Your Library</h1>
          <p class="view-main-subtitle">Your local music collection</p>
        </div>
        <div class="empty-library-container">
          <div class="empty-dropzone-box" onclick="window.app.requestFolderAccess()">
            <div class="empty-icon-halo">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="3"></circle>
                <path d="M12 10v3l2 1"></path>
              </svg>
            </div>
            <h2 class="empty-drop-title">Your Library is Empty</h2>
            <p class="empty-drop-subtitle">
              Connect your Music folder to automatically load and organize your songs.<br/>
              WAVEN reads your audio files locally with zero uploads.
            </p>
            <div class="empty-actions-row" onclick="event.stopPropagation()">
              <button class="btn-primary" onclick="window.app.requestFolderAccess()" style="display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  <line x1="12" y1="11" x2="12" y2="17"></line>
                  <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
                Select Music Folder
              </button>
              <button class="btn-secondary" onclick="window.app.requestFileAccess()" style="display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Choose Audio Files
              </button>
            </div>
            <p class="empty-formats-note">
              Drag &amp; drop audio files or folders here • MP3, WAV, FLAC, M4A, AAC, OGG
            </p>
          </div>
        </div>
      `;
      return;
    }

    const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    const formattedTotalTime = this.formatTotalDuration(totalSeconds);

    tracks = this.sortTracks(tracks, this.currentSortField, this.currentSortOrder);

    container.innerHTML = `
      <div class="waven-view-header library-header-layout">
        <div class="library-header-text">
          <h1 class="view-main-title">Your Library</h1>
          <p class="view-main-subtitle">
            <span>${totalCount} songs</span>
            <span>•</span>
            <span>${formattedTotalTime}</span>
          </p>
        </div>

        <div class="library-header-actions">
          <button class="btn-primary library-action-btn" onclick="window.libraryManager.playAll(false)" aria-label="Play All">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Play All</span>
          </button>
          <button class="btn-secondary library-action-btn" onclick="window.libraryManager.playAll(true)" aria-label="Shuffle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
            <span>Shuffle</span>
          </button>
          <button class="btn-secondary library-action-btn" onclick="if (window.organizerManager) window.organizerManager.openToolsModal();" aria-label="Library Tools">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Library Tools</span>
          </button>
        </div>
      </div>

      <!-- Quick Subnav Filter Row -->
      <div class="library-subnav-row" style="margin-bottom: 20px;">
        <div class="subnav-pills">
          <button class="filter-pill active" onclick="window.navigation.navigateTo('library')">All Songs (${totalCount})</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('albums')">Albums</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('artists')">Artists</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('genres')">Genres</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('liked')">Favourites</button>
        </div>

        <div class="sort-select-wrapper">
          <label class="sort-label">Sort:</label>
          <select class="sort-select" onchange="window.libraryManager.handleSortChange(this.value)">
            <option value="addedAt_desc" ${this.currentSortField === 'addedAt' && this.currentSortOrder === 'desc' ? 'selected' : ''}>Recently Added</option>
            <option value="title_asc" ${this.currentSortField === 'title' && this.currentSortOrder === 'asc' ? 'selected' : ''}>Title (A - Z)</option>
            <option value="artist_asc" ${this.currentSortField === 'artist' && this.currentSortOrder === 'asc' ? 'selected' : ''}>Artist (A - Z)</option>
            <option value="duration_desc" ${this.currentSortField === 'duration' && this.currentSortOrder === 'desc' ? 'selected' : ''}>Duration</option>
          </select>
        </div>
      </div>

      <!-- Tracklist Card -->
      <div class="waven-tracklist-card">
        ${tracks.map(track => this.renderWavenTrackRow(track)).join("")}
      </div>
    `;

    this.updatePlayingRowIndicators();
  }

  getLocalAlbums() {
    const allTracks = this.getAllAvailableTracks();
    const map = new Map();
    allTracks.forEach(t => {
      const alb = (t.album && t.album.trim()) ? t.album.trim() : "Unknown Album";
      if (!map.has(alb)) {
        map.set(alb, {
          name: alb,
          artist: t.artist || "Unknown Artist",
          artwork: t.artwork || "assets/covers/default_cover.svg",
          tracks: []
        });
      }
      map.get(alb).tracks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getLocalArtists() {
    const allTracks = this.getAllAvailableTracks();
    const map = new Map();
    allTracks.forEach(t => {
      const art = (t.artist && t.artist.trim()) ? t.artist.trim() : "Unknown Artist";
      if (!map.has(art)) {
        map.set(art, {
          name: art,
          artwork: t.artwork || "assets/covers/default_cover.svg",
          tracks: []
        });
      }
      map.get(art).tracks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getLocalGenres() {
    const allTracks = this.getAllAvailableTracks();
    const map = new Map();
    const palettes = [
      "linear-gradient(135deg, #4f46e5, #06b6d4)",
      "linear-gradient(135deg, #ec4899, #8b5cf6)",
      "linear-gradient(135deg, #10b981, #3b82f6)",
      "linear-gradient(135deg, #f59e0b, #ef4444)",
      "linear-gradient(135deg, #6366f1, #a855f7)",
      "linear-gradient(135deg, #0ea5e9, #14b8a6)"
    ];
    let pIdx = 0;
    allTracks.forEach(t => {
      const g = (t.genre && t.genre.trim()) ? t.genre.trim() : "Other";
      if (!map.has(g)) {
        map.set(g, {
          name: g,
          icon: "🎵",
          gradient: palettes[pIdx % palettes.length],
          count: 0,
          tracks: []
        });
        pIdx++;
      }
      map.get(g).count++;
      map.get(g).tracks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  // -------------------------------------------------------------
  // ALBUMS VIEW & DETAIL
  // -------------------------------------------------------------

  renderAlbumsView() {
    const container = document.getElementById("library-view-content");
    if (!container) return;

    const albums = this.getLocalAlbums();

    container.innerHTML = `
      <div class="waven-view-header">
        <h1 class="view-main-title">Albums</h1>
        <p class="view-main-subtitle">Albums discovered in your local music library</p>
      </div>

      <div class="library-subnav-row" style="margin-bottom: 24px;">
        <div class="subnav-pills">
          <button class="filter-pill" onclick="window.navigation.navigateTo('library')">All Songs</button>
          <button class="filter-pill active" onclick="window.navigation.navigateTo('albums')">Albums (${albums.length})</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('artists')">Artists</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('genres')">Genres</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('liked')">Favourites</button>
        </div>
      </div>

      ${albums.length === 0 ? `
        <div class="empty-state-box" style="padding: 40px; text-align: center;">
          <h3 style="color: #fff; margin-bottom: 8px;">No Albums Detected</h3>
          <p style="color: #8b92a4; font-size: 0.9rem;">Audio files with ID3 album tags will appear here automatically.</p>
        </div>
      ` : `
        <div class="waven-albums-grid">
          ${albums.map(al => {
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
              <span class="album-card-artist">${al.artist} • ${al.tracks.length} track${al.tracks.length === 1 ? '' : 's'}</span>
            </div>
          `}).join("")}
        </div>
      `}
    `;
  }

  renderAlbumDetails(albumNameEncoded) {
    const container = document.getElementById("album-view-content");
    if (!container) return;

    const albumName = decodeURIComponent(albumNameEncoded);
    const allTracks = this.getAllAvailableTracks();
    const tracks = allTracks.filter(t => (t.album || "Single") === albumName);

    if (tracks.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box" style="padding: 40px; text-align: center;">
          <h3 style="color: #fff; margin-bottom: 12px;">Album not found</h3>
          <button class="btn-primary" onclick="window.navigation.navigateTo('albums')">Back to Albums</button>
        </div>
      `;
      return;
    }

    const first = tracks[0];
    const totalSecs = tracks.reduce((a, b) => a + (b.duration || 0), 0);
    const durStr = this.formatTotalDuration(totalSecs);

    const firstArt = (first.artwork && !first.artwork.includes('default_cover.svg')) ? first.artwork : (window.getTrackFallbackArtwork ? window.getTrackFallbackArtwork(albumName, first.artist) : 'assets/covers/default_cover.svg');

    container.innerHTML = `
      <div class="waven-detail-hero">
        <div class="detail-hero-art-box">
          <img src="${firstArt}" alt="${albumName}" data-title="${albumName}" data-artist="${first.artist}" onerror="window.handleTrackImgError(this)" />
        </div>
        <div class="detail-hero-info">
          <span class="detail-hero-badge">ALBUM</span>
          <h1 class="detail-hero-title">${albumName}</h1>
          <p class="detail-hero-sub">
            <span style="color: #fff; font-weight: 600;">${first.artist}</span>
            <span>•</span>
            <span>${tracks.length} songs</span>
            <span>•</span>
            <span>${durStr}</span>
          </p>
          <div class="detail-hero-actions">
            <button class="btn-primary" onclick="window.libraryManager.playTrackList(${JSON.stringify(tracks.map(t => t.id))})" style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Play Album
            </button>
            <button class="btn-secondary" onclick="window.navigation.navigateTo('albums')">
              Back to Albums
            </button>
          </div>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <span style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 14px; display: block;">Tracks (${tracks.length})</span>
        <div class="waven-tracklist-card">
          ${tracks.map(t => this.renderWavenTrackRow(t)).join("")}
        </div>
      </div>
    `;

    this.updatePlayingRowIndicators();
  }

  // -------------------------------------------------------------
  // ARTISTS VIEW & DETAIL
  // -------------------------------------------------------------

  renderArtistsView() {
    const container = document.getElementById("library-view-content");
    if (!container) return;

    const artists = this.getLocalArtists();

    container.innerHTML = `
      <div class="waven-view-header">
        <h1 class="view-main-title">Artists</h1>
        <p class="view-main-subtitle">Singers, bands, and creators from your local collection</p>
      </div>

      <div class="library-subnav-row" style="margin-bottom: 24px;">
        <div class="subnav-pills">
          <button class="filter-pill" onclick="window.navigation.navigateTo('library')">All Songs</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('albums')">Albums</button>
          <button class="filter-pill active" onclick="window.navigation.navigateTo('artists')">Artists (${artists.length})</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('genres')">Genres</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('liked')">Favourites</button>
        </div>
      </div>

      ${artists.length === 0 ? `
        <div class="empty-state-box" style="padding: 40px; text-align: center;">
          <h3 style="color: #fff; margin-bottom: 8px;">No Artists Found</h3>
          <p style="color: #8b92a4; font-size: 0.9rem;">Audio files with artist metadata will be listed here.</p>
        </div>
      ` : `
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
      `}
    `;
  }

  renderArtistDetails(artistNameEncoded) {
    const container = document.getElementById("artist-view-content");
    if (!container) return;

    const artistName = decodeURIComponent(artistNameEncoded);
    const allTracks = this.getAllAvailableTracks();
    const tracks = allTracks.filter(t => (t.artist || "Unknown Artist") === artistName);

    if (tracks.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box" style="padding: 40px; text-align: center;">
          <h3 style="color: #fff; margin-bottom: 12px;">Artist not found</h3>
          <button class="btn-primary" onclick="window.navigation.navigateTo('artists')">Back to Artists</button>
        </div>
      `;
      return;
    }

    const first = tracks[0];

    const firstArt = (first.artwork && !first.artwork.includes('default_cover.svg')) ? first.artwork : (window.getTrackFallbackArtwork ? window.getTrackFallbackArtwork(artistName, "") : 'assets/covers/default_cover.svg');

    container.innerHTML = `
      <div class="waven-detail-hero">
        <div class="detail-hero-art-box" style="border-radius: var(--radius-full); overflow: hidden; width: 140px; height: 140px;">
          <img src="${firstArt}" alt="${artistName}" data-title="${artistName}" data-artist="" onerror="window.handleTrackImgError(this)" />
        </div>
        <div class="detail-hero-info">
          <span class="detail-hero-badge">ARTIST</span>
          <h1 class="detail-hero-title">${artistName}</h1>
          <p class="detail-hero-sub">${tracks.length} track${tracks.length === 1 ? '' : 's'} in library</p>
          <div class="detail-hero-actions">
            <button class="btn-primary" onclick="window.libraryManager.playTrackList(${JSON.stringify(tracks.map(t => t.id))})" style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Play All Songs
            </button>
            <button class="btn-secondary" onclick="window.navigation.navigateTo('artists')">
              Back to Artists
            </button>
          </div>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <span style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 14px; display: block;">Songs</span>
        <div class="waven-tracklist-card">
          ${tracks.map(t => this.renderWavenTrackRow(t)).join("")}
        </div>
      </div>
    `;

    this.updatePlayingRowIndicators();
  }

  // -------------------------------------------------------------
  // GENRES VIEW
  // -------------------------------------------------------------

  renderGenresView(genreFilter = null) {
    const container = document.getElementById("library-view-content");
    if (!container) return;

    this.selectedGenre = genreFilter;
    const genres = this.getLocalGenres();
    const allTracks = this.getAllAvailableTracks();

    let filteredTracks = allTracks;
    if (genreFilter) {
      filteredTracks = allTracks.filter(t => (t.genre || "").toLowerCase().includes(genreFilter.toLowerCase()));
    }

    container.innerHTML = `
      <div class="waven-view-header">
        <h1 class="view-main-title">Genres & Moods</h1>
        <p class="view-main-subtitle">Browse songs by energy, style, and musical vibe</p>
      </div>

      <div class="library-subnav-row" style="margin-bottom: 24px;">
        <div class="subnav-pills">
          <button class="filter-pill" onclick="window.navigation.navigateTo('library')">All Songs</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('albums')">Albums</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('artists')">Artists</button>
          <button class="filter-pill active" onclick="window.navigation.navigateTo('genres')">Genres</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('liked')">Favourites</button>
        </div>
      </div>

      <!-- Genres Grid -->
      <div class="waven-genres-grid" style="margin-bottom: 32px;">
        ${genres.map(g => {
          const isSelected = (this.selectedGenre === g.name);
          return `
            <div class="waven-genre-card ${isSelected ? 'active-genre' : ''}" style="background: ${g.gradient};" onclick="window.libraryManager.renderGenresView('${g.name}')">
              <span class="genre-icon">${g.icon}</span>
              <span class="genre-name">${g.name}</span>
              <span class="genre-count">${g.count}</span>
            </div>
          `;
        }).join("")}
      </div>

      <!-- Filtered Tracks -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <span style="font-size: 0.95rem; font-weight: 700; color: #fff;">
            ${genreFilter ? `${genreFilter} Songs (${filteredTracks.length})` : `All Songs (${filteredTracks.length})`}
          </span>
          ${genreFilter ? `<button style="font-size: 0.82rem; color: #8b92a4; cursor: pointer;" onclick="window.libraryManager.renderGenresView(null)">Clear Filter</button>` : ''}
        </div>
        <div class="waven-tracklist-card">
          ${filteredTracks.map(t => this.renderWavenTrackRow(t)).join("")}
        </div>
      </div>
    `;

    this.updatePlayingRowIndicators();
  }

  // -------------------------------------------------------------
  // LIKED SONGS / FAVOURITES VIEW
  // -------------------------------------------------------------

  renderLikedSongsView() {
    const container = document.getElementById("liked-view-content");
    if (!container) return;

    const allTracks = this.getAllAvailableTracks();
    const liked = allTracks.filter(t => window.storageService ? window.storageService.isLiked(t.id) : false);

    if (liked.length === 0) {
      container.innerHTML = `
        <div class="waven-view-header">
          <h1 class="view-main-title">Favourites</h1>
          <p class="view-main-subtitle">Your saved and loved music tracks</p>
        </div>

        <div class="library-subnav-row" style="margin-bottom: 20px;">
          <div class="subnav-pills">
            <button class="filter-pill" onclick="window.navigation.navigateTo('library')">All Songs</button>
            <button class="filter-pill" onclick="window.navigation.navigateTo('albums')">Albums</button>
            <button class="filter-pill" onclick="window.navigation.navigateTo('artists')">Artists</button>
            <button class="filter-pill" onclick="window.navigation.navigateTo('genres')">Genres</button>
            <button class="filter-pill active" onclick="window.navigation.navigateTo('liked')">Favourites (0)</button>
          </div>
        </div>

        <div class="empty-state-box" style="margin-top: 24px; padding: 48px 20px; text-align: center;">
          <div class="empty-icon-wrap" style="margin: 0 auto 16px; background: rgba(239, 68, 68, 0.15); color: #ef4444; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </div>
          <h2 class="empty-title" style="color: #fff; font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">No Favourites Yet</h2>
          <p class="empty-desc" style="color: #8b92a4; font-size: 0.9rem; margin-bottom: 24px;">Click the heart icon on any song to save it to your Favourites collection.</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn-primary" onclick="window.navigation.navigateTo('library')">Browse All Songs</button>
            <button class="btn-secondary" onclick="window.app.requestFolderAccess()">Select Music Folder</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="library-subnav-row" style="margin-bottom: 20px;">
        <div class="subnav-pills">
          <button class="filter-pill" onclick="window.navigation.navigateTo('library')">All Songs</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('albums')">Albums</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('artists')">Artists</button>
          <button class="filter-pill" onclick="window.navigation.navigateTo('genres')">Genres</button>
          <button class="filter-pill active" onclick="window.navigation.navigateTo('liked')">Favourites (${liked.length})</button>
        </div>
      </div>

      <div class="waven-detail-hero" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(139, 92, 246, 0.15) 100%), rgba(20, 22, 28, 0.7);">
        <div class="detail-hero-art-box" style="background: linear-gradient(135deg, #ef4444, #8b5cf6); display: flex; align-items: center; justify-content: center;">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </div>
        <div class="detail-hero-info">
          <span class="detail-hero-badge" style="background: rgba(239, 68, 68, 0.25); color: #fca5a5;">COLLECTION</span>
          <h1 class="detail-hero-title">Favourites</h1>
          <p class="detail-hero-sub">${liked.length} saved track${liked.length === 1 ? '' : 's'}</p>
          <div class="detail-hero-actions">
            <button class="btn-primary" onclick="window.libraryManager.playTrackList(${JSON.stringify(liked.map(t => t.id))})" style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Play Favourites
            </button>
          </div>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <div class="waven-tracklist-card">
          ${liked.map(t => this.renderWavenTrackRow(t)).join("")}
        </div>
      </div>
    `;

    this.updatePlayingRowIndicators();
  }

  // -------------------------------------------------------------
  // REUSABLE WAVEN TRACK ROW
  // -------------------------------------------------------------

  renderWavenTrackRow(track) {
    const currentTrackId = window.player?.state?.currentTrack?.id;
    const isPlayingThis = (currentTrackId === track.id);
    const isLiked = window.storageService ? window.storageService.isLiked(track.id) : false;
    const durText = track.durStr || (window.player ? window.player.formatTime(track.duration) : '0:00');
    const art = window.getTrackArtwork ? window.getTrackArtwork(track) : (track.artwork || 'assets/covers/default_cover.svg');

    const safeTrackId = encodeURIComponent(track.id);

    return `
      <div class="waven-track-row ${isPlayingThis ? 'active-playing active-selected' : ''}" data-track-id="${track.id}" onclick="window.libraryManager ? window.libraryManager.playTrackById(decodeURIComponent('${safeTrackId}')) : (window.player && window.player.playTrack(window.storageService ? window.storageService.getTrackById(decodeURIComponent('${safeTrackId}')) : null))">
        <div class="track-thumb-circle">
          <img src="${art}" alt="${track.title}" data-title="${track.title || ''}" data-artist="${track.artist || ''}" onerror="window.handleTrackImgError(this)" />
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
          <span class="track-row-title ${isPlayingThis ? 'selected-title-sliding' : ''}">${track.title}</span>
          <span class="track-row-artist">${track.artist || 'Local Audio'}</span>
        </div>
        <span class="track-row-dur">${durText}</span>
        <button class="track-row-heart-btn ${isLiked ? 'active' : ''}" aria-label="Add to Favourites" onclick="event.stopPropagation(); window.app.toggleTrackFavourite('${track.id}', this)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#ef4444' : 'none'}" stroke="${isLiked ? '#ef4444' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
        <button class="track-row-more-chip" aria-label="Options" onclick="window.app.openContextMenu(event, '${track.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg>
        </button>
      </div>
    `;
  }

  updatePlayingRowIndicators() {
    const currentTrackId = window.player?.state?.currentTrack?.id;
    const isPlaying = window.player?.state?.isPlaying;

    document.querySelectorAll(".waven-track-row").forEach(row => {
      const rowId = row.getAttribute("data-track-id");
      const eq = row.querySelector(".track-row-equalizer");

      if (rowId === currentTrackId) {
        row.classList.add("active-playing", "active-selected");
        if (eq) {
          if (isPlaying) eq.classList.add("playing");
          else eq.classList.remove("playing");
        }
      } else {
        row.classList.remove("active-playing", "active-selected");
        if (eq) eq.classList.remove("playing");
      }
    });

    if (window.app && window.app.updateActiveTitleAnimations) {
      window.app.updateActiveTitleAnimations();
    }
  }

  playTrackById(trackId) {
    if (!trackId) return;
    const all = this.getAllAvailableTracks();
    const track = all.find(t => t.id === trackId) || (window.storageService ? window.storageService.getTrackById(trackId) : null);
    if (track && window.player) {
      window.player.playTrack(track, all.length > 0 ? all : null);
    }
  }

  playTrackList(trackIds) {
    if (!Array.isArray(trackIds) || trackIds.length === 0) return;
    const tracks = trackIds
      .map(id => window.WAVEN_CATALOG ? window.WAVEN_CATALOG.getTrack(id) : window.storageService?.getTrackById(id))
      .filter(Boolean);
    if (tracks.length > 0) {
      window.player.playTrack(tracks[0], tracks);
    }
  }

  playAll(isShuffle = false) {
    let tracks = this.getAllAvailableTracks();
    if (tracks.length === 0) return;
    tracks = this.sortTracks(tracks, this.currentSortField, this.currentSortOrder);

    if (isShuffle) {
      const randIdx = Math.floor(Math.random() * tracks.length);
      window.player.state.shuffle = true;
      window.player._updateShuffleUI();
      window.player.playTrack(tracks[randIdx], tracks);
    } else {
      window.player.playTrack(tracks[0], tracks);
    }
  }

  handleSortChange(val) {
    const [field, order] = val.split("_");
    this.currentSortField = field;
    this.currentSortOrder = order;

    if (window.storageService) {
      window.storageService.saveSettings({ sortField: field, sortOrder: order });
    }

    this.renderLibraryView();
  }

  sortTracks(tracks, field, order) {
    const copy = [...tracks];
    copy.sort((a, b) => {
      let res = 0;
      if (field === "title") {
        res = (a.title || "").localeCompare(b.title || "");
      } else if (field === "artist") {
        res = (a.artist || "").localeCompare(b.artist || "");
      } else if (field === "album") {
        res = (a.album || "").localeCompare(b.album || "");
      } else if (field === "duration") {
        res = (a.duration || 0) - (b.duration || 0);
      } else if (field === "addedAt") {
        res = (a.addedAt || 0) - (b.addedAt || 0);
      }
      return order === "desc" ? -res : res;
    });
    return copy;
  }

  formatTotalDuration(seconds) {
    if (!seconds) return "0 min";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs} hr${hrs === 1 ? '' : 's'} ${mins} min${mins === 1 ? '' : 's'}`;
    }
    return `${mins} min${mins === 1 ? '' : 's'}`;
  }

  formatDuration(seconds) {
    return window.player ? window.player.formatTime(seconds) : "3:30";
  }
}

window.libraryManager = new LibraryManager();
