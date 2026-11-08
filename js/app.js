/**
 * AR7 MUSIC — MAIN APPLICATION CONTROLLER
 * Bootstraps local music subsystems, UI bindings, home feeds, context menus,
 * keyboard controls, and settings.
 */

/**
 * Centralized track artwork resolver and procedural gradient generator
 */
window.getTrackFallbackArtwork = function(title = "", artist = "") {
  if (window.MetadataParser && typeof window.MetadataParser.generateFallbackArtwork === "function") {
    return window.MetadataParser.generateFallbackArtwork(title, artist);
  }
  return "assets/covers/default_cover.svg";
};

window.getTrackArtwork = function(track) {
  if (track && track.artwork && track.artwork !== "assets/covers/default_cover.svg" && !track.artwork.includes("default_cover.svg")) {
    return track.artwork;
  }
  const t = track ? (track.title || "") : "";
  const a = track ? (track.artist || "") : "";
  return window.getTrackFallbackArtwork(t, a);
};

window.handleTrackImgError = function(img, explicitTitle = "", explicitArtist = "") {
  if (!img) return;
  img.onerror = null;
  const title = explicitTitle || img.dataset.title || (window.player?.state?.currentTrack?.title) || "";
  const artist = explicitArtist || img.dataset.artist || (window.player?.state?.currentTrack?.artist) || "";
  img.src = window.getTrackFallbackArtwork(title, artist);
};

class AppController {
  constructor() {
    this.selectedContextMenuTrack = null;
    this.toastTimer = null;
  }

  async init() {
    console.log("Initializing WAVEN Local Music Player...");

    // 1. Initialize IndexedDB storage first
    if (window.storageService) {
      await window.storageService.init();
    }

    // 2. Initialize subsystems
    if (window.importManager) window.importManager.init();
    if (window.playlistsManager) window.playlistsManager.init();
    if (window.libraryManager) window.libraryManager.init();
    if (window.historyManager) window.historyManager.init();
    if (window.searchManager) window.searchManager.init();
    if (window.navigation) window.navigation.init();

    this._applySavedTheme();
    this._bindPlayerUI();
    this._bindSeekAndVolumeSliders();
    this._bindGlobalEvents();
    this._bindKeyboardShortcuts();

    // 3. Render initial view
    if (window.navigation && window.navigation.currentView === "home") {
      this.loadHomeFeeds();
    }

    // Sync initial hero player card
    this._syncInitialHeroPlayer();

    // Check if running in Android Native App and scan device music
    if (window.AndroidBridge && typeof window.AndroidBridge.isAndroidApp === "function") {
      this.checkAndLoadAndroidDeviceSongs();
    } else {
      // Check storage permission on open for web: if user has 0 tracks, prompt for folder access
      const initialTracks = window.storageService ? window.storageService.getAllTracks() : [];
      if (initialTracks.length === 0) {
        this.showStoragePermissionModal();
      }
    }
  }

  checkAndLoadAndroidDeviceSongs() {
    if (!window.AndroidBridge) return;
    try {
      const json = typeof window.AndroidBridge.getScannedSongs === "function" ? window.AndroidBridge.getScannedSongs() : "[]";
      if (json && json !== "[]") {
        const tracks = JSON.parse(json);
        if (tracks && tracks.length > 0) {
          this.loadNativeDeviceTracks(tracks);
          return;
        }
      }
      if (typeof window.AndroidBridge.triggerDeviceScan === "function") {
        window.AndroidBridge.triggerDeviceScan();
      }
    } catch (e) {
      console.warn("[WAVEN Android] Device scan error:", e);
    }
  }

  _resolveLastPlayedTrack(allTracks = []) {
    let savedTrackId = null;
    let savedTrackJson = null;
    try {
      savedTrackId = localStorage.getItem('ar7_last_played_track_id');
      savedTrackJson = localStorage.getItem('ar7_last_played_track');
    } catch (e) {}

    if (savedTrackId && allTracks && allTracks.length > 0) {
      const match = allTracks.find(t => t.id === savedTrackId || (t.title && savedTrackId && t.title.toLowerCase() === savedTrackId.toLowerCase()));
      if (match) return match;
    }

    if (savedTrackJson) {
      try {
        const parsed = JSON.parse(savedTrackJson);
        if (parsed && parsed.id) {
          if (allTracks && allTracks.length > 0) {
            const match = allTracks.find(t => t.id === parsed.id || (t.title && parsed.title && t.title.toLowerCase() === parsed.title.toLowerCase()));
            if (match) return match;
          }
          return parsed;
        }
      } catch (e) {}
    }

    if (window.storageService) {
      const history = window.storageService.getHistory(1);
      if (history.length > 0 && history[0].track) {
        return history[0].track;
      }
    }

    return (allTracks && allTracks.length > 0) ? allTracks[0] : null;
  }

  loadNativeDeviceTracks(tracks) {
    if (!tracks || tracks.length === 0) return;
    this.hideStoragePermissionModal();
    // Ensure all tracks have procedural artwork if lacking artwork
    tracks.forEach(t => {
      if (!t.artwork || t.artwork.includes("default_cover.svg")) {
        t.artwork = window.getTrackArtwork(t);
      }
    });
    if (window.storageService) {
      window.storageService.saveTracks(tracks).then(() => {
        if (window.libraryManager) {
          window.libraryManager.refreshCurrentView();
        }
        if (window.navigation && window.navigation.currentView === "home") {
          this.loadHomeFeeds();
        }
        const trackToLoad = this._resolveLastPlayedTrack(tracks);
        if (window.queueManager && tracks.length > 0) {
          window.queueManager.setQueue(tracks, trackToLoad || tracks[0]);
        }
        if (trackToLoad && window.player) {
          if (!window.player.state.currentTrack) {
            window.player.state.currentTrack = trackToLoad;
            window.player._updateTrackInfoUI(trackToLoad);
          }
          if (window.player._syncNativeNotification) {
            window.player._syncNativeNotification(false, window.player.state.currentTrack);
          }
        }
        this.showToast(`Loaded ${tracks.length} track${tracks.length === 1 ? '' : 's'} from your device`, "success");
      });
    }
  }

  _syncInitialHeroPlayer() {
    const tracks = window.storageService ? window.storageService.getAllTracks() : [];
    const trackToLoad = this._resolveLastPlayedTrack(tracks);
    if (trackToLoad) {
      if (window.player && !window.player.state.currentTrack) {
        window.player.state.currentTrack = trackToLoad;
        window.player._updateTrackInfoUI(trackToLoad);
        if (window.player._syncNativeNotification) {
          window.player._syncNativeNotification(false);
        }
        if (tracks.length > 0 && window.queueManager) {
          window.queueManager.setQueue(tracks, trackToLoad);
        }
      }
    } else {
      if (window.player) {
        window.player.state.currentTrack = null;
      }
      const heroBg = document.getElementById("player-card-bg");
      if (heroBg) {
        heroBg.style.backgroundImage = "none";
        heroBg.style.background = "radial-gradient(circle at 50% 30%, #1e2638 0%, #0d0f14 80%)";
      }
      const heroTitle = document.getElementById("hero-player-title");
      if (heroTitle) heroTitle.textContent = "No Track Loaded";
      const heroArtist = document.getElementById("hero-player-artist");
      if (heroArtist) heroArtist.textContent = "Select music to start playing";
      const heroBadge = document.getElementById("player-card-badge");
      if (heroBadge) heroBadge.textContent = "Local Audio";
      const heroFormat = document.getElementById("hero-player-format");
      if (heroFormat) heroFormat.textContent = "LOCAL AUDIO";

      document.querySelectorAll(".time-stamp.current").forEach(el => el.textContent = "00:00");
      document.querySelectorAll(".time-stamp.duration").forEach(el => el.textContent = "00:00");
      document.querySelectorAll(".seek-bar-fill").forEach(el => el.style.width = "0%");
      document.querySelectorAll(".seek-bar-thumb").forEach(el => el.style.left = "0%");
      document.querySelectorAll(".play-toggle-btn").forEach(btn => {
        btn.classList.remove("playing");
        btn.setAttribute("title", "Play");
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      });
    }
  }

  _applySavedTheme() {
    const settings = window.storageService ? window.storageService.getSettings() : {};
    const theme = settings.theme || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    if (document.body) document.body.setAttribute("data-theme", theme);
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  loadHomeFeeds() {
    const homeView = document.getElementById("home-view");
    if (!homeView) return;

    const tracks = window.storageService ? window.storageService.getAllTracks() : [];

    // CASE 1: Empty Local Library (0 tracks imported yet)
    if (tracks.length === 0) {
      homeView.innerHTML = `
        <div class="empty-home-state">
          <div class="empty-dropzone-box" onclick="window.app.requestFolderAccess()">
            <div class="empty-icon-halo">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="3"></circle>
                <path d="M12 10v3l2 1"></path>
              </svg>
            </div>
            <h2 class="empty-drop-title">No Local Music Loaded</h2>
            <p class="empty-drop-subtitle">
              WAVEN plays audio files directly from your computer with zero upload.<br />
              Select your Music folder to automatically load your songs.
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

    // CASE 2: User HAS Local Tracks!
    // Derive Card 1 (Recently Played), Card 2 (Favourites), Card 3 (Recently Added)
    const historyList = window.storageService ? window.storageService.getHistory(10) : [];
    const favSet = window.storageService ? window.storageService.favouritesSet : new Set();
    const favList = tracks.filter(t => favSet.has(t.id));

    // Card 1: Recently Played
    let card1Track = (historyList.length > 0 && historyList[0].track) ? historyList[0].track : tracks[0];
    let card1Badge = (historyList.length > 0 && historyList[0].track) ? "Recently Played" : "Recently Added";
    let card1Sub = card1Track.album ? card1Track.album : "Local Audio";

    // Card 2: Favourites / Most Played
    let card2Track = favList.length > 0 ? favList[0] : (tracks.length > 1 ? tracks[1] : tracks[0]);
    let card2Badge = favList.length > 0 ? "Favourites" : (tracks.length > 1 ? "Library Pick" : "Local Audio");
    let card2Sub = card2Track.album ? card2Track.album : (favList.length > 0 ? "In your favourites" : "Local Audio");

    // Card 3: Recently Added
    let card3Track = tracks.length > 2 ? tracks[2] : (tracks.length > 1 ? tracks[1] : tracks[0]);
    let card3Badge = "Recently Added";
    let card3Sub = card3Track.album ? card3Track.album : "Added to library";

    const topCards = [
      { track: card1Track, badge: card1Badge, sub: card1Sub },
      { track: card2Track, badge: card2Badge, sub: card2Sub },
      { track: card3Track, badge: card3Badge, sub: card3Sub }
    ];

    const dotColors = ["#38bdf8", "#f43f5e", "#10b981"];
    const currentTrackId = window.player?.state?.currentTrack?.id || null;
    const isPlaying = window.player?.state?.isPlaying || false;

    const cardsHtml = topCards.map((c, idx) => {
      const t = c.track;
      const isLiked = window.storageService ? window.storageService.isLiked(t.id) : false;
      const art = window.getTrackArtwork(t);
      const dotColor = dotColors[idx % dotColors.length];
      const durStr = window.libraryManager ? window.libraryManager.formatDuration(t.duration || 0) : "";
      const formatStr = (t.fileType || t.format || "LOCAL").toUpperCase();
      const isThisPlaying = (currentTrackId === t.id && isPlaying);
      const isThisSelected = (currentTrackId === t.id);

      return `
        <div class="waven-hub-card ${isThisSelected ? 'active-selected' : ''} ${isThisPlaying ? 'active-playing' : ''}" data-card-idx="${idx}" data-track-id="${t.id}" onclick="window.app.toggleCardPlay('${t.id}')">
          <div class="hub-card-bg" style="background-image: url('${art}');"></div>
          <div class="hub-card-gradient"></div>
          
          <div class="hub-card-top">
            <span class="hub-card-badge">
              <span class="hub-badge-dot" style="background-color: ${dotColor}; box-shadow: 0 0 8px ${dotColor};"></span>
              ${c.badge}
            </span>
            <button class="hub-card-heart ${isLiked ? 'active' : ''}" onclick="event.stopPropagation(); window.app.toggleTrackFavourite('${t.id}', this)" aria-label="Save to Favourites">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${isLiked ? '#ef4444' : 'none'}" stroke="${isLiked ? '#ef4444' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
          </div>

          <div class="hub-card-bottom">
            <div class="hub-card-meta">
              <h3 class="hub-card-title ${isThisSelected ? 'selected-title-sliding' : ''}">${this.escapeHtml(t.title || 'Unknown Title')}</h3>
              <p class="hub-card-artist">${this.escapeHtml(t.artist || 'Local Audio')}</p>
              <div class="hub-card-info-row">
                <span class="hub-card-tag">${formatStr}</span>
                ${durStr ? `<span class="hub-card-dur">${durStr}</span>` : ''}
              </div>
            </div>
            <button class="hub-card-play-btn ${isThisPlaying ? 'playing' : ''}" aria-label="${isThisPlaying ? 'Pause' : 'Play'}" onclick="event.stopPropagation(); window.app.toggleCardPlay('${t.id}')">
              ${isThisPlaying ? `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              ` : `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
              `}
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Bottom Tracklist Rows: user's real local songs
    const displayRows = tracks.slice(0, 10); // Show up to 10 on home, scrollable

    const rowsHtml = displayRows.map(item => {
      const isThisSelected = (currentTrackId === item.id);
      const isThisPlaying = (currentTrackId === item.id && isPlaying);
      const isLiked = window.storageService ? window.storageService.isLiked(item.id) : false;
      const durStr = window.libraryManager ? window.libraryManager.formatDuration(item.duration || 0) : "0:00";
      const art = window.getTrackArtwork(item);
      const safeItemId = encodeURIComponent(item.id);
      return `
        <div class="waven-track-row ${isThisSelected ? 'active-selected' : ''} ${isThisPlaying ? 'active-playing' : ''}" data-track-id="${item.id}" onclick="window.app.handleTrackRowClick(decodeURIComponent('${safeItemId}'))">
          <div class="track-thumb-circle">
            <img src="${art}" alt="${this.escapeHtml(item.title)}" data-title="${this.escapeHtml(item.title || '')}" data-artist="${this.escapeHtml(item.artist || '')}" onerror="window.handleTrackImgError(this)" />
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
            <span class="track-row-title ${isThisSelected ? 'selected-title-sliding' : ''}">${this.escapeHtml(item.title || 'Unknown Title')}</span>
            <span class="track-row-artist">${this.escapeHtml(item.artist || 'Local Audio')}</span>
          </div>
          <span class="track-row-dur">${durStr}</span>
          <button class="track-row-heart-btn ${isLiked ? 'active' : ''}" aria-label="Add to Favourites" onclick="event.stopPropagation(); window.app.toggleTrackFavourite('${item.id}', this)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#ef4444' : 'none'}" stroke="${isLiked ? '#ef4444' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </button>
          <button class="track-row-more-chip" aria-label="Options" onclick="window.app.openContextMenu(event, '${item.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg>
          </button>
        </div>
      `;
    }).join("");

    homeView.innerHTML = `
      <div class="waven-hub-cards-grid" id="waven-hub-cards-carousel">
        ${cardsHtml}
      </div>
      <div class="hub-carousel-dots" id="hub-carousel-dots">
        <span class="hub-dot active" data-idx="0"></span>
        <span class="hub-dot" data-idx="1"></span>
        <span class="hub-dot" data-idx="2"></span>
      </div>
      <div id="mood-studio-container" class="home-feature-container"></div>
      <div id="forgotten-gems-container" class="home-feature-container"></div>
      <div class="waven-tracklist-card">
        ${rowsHtml}
      </div>
    `;

    const carousel = document.getElementById("waven-hub-cards-carousel");
    const dots = document.querySelectorAll(".hub-dot");
    if (carousel && dots.length > 0) {
      carousel.addEventListener("scroll", () => {
        const cardWidth = carousel.firstElementChild ? carousel.firstElementChild.offsetWidth + 12 : 280;
        const activeIdx = Math.max(0, Math.min(dots.length - 1, Math.round(carousel.scrollLeft / cardWidth)));
        dots.forEach((dot, idx) => {
          dot.classList.toggle("active", idx === activeIdx);
        });
      }, { passive: true });

      dots.forEach((dot, idx) => {
        dot.addEventListener("click", () => {
          const cardWidth = carousel.firstElementChild ? carousel.firstElementChild.offsetWidth + 12 : 280;
          carousel.scrollTo({ left: idx * cardWidth, behavior: "smooth" });
        });
      });
    }

    if (window.moodStudio) {
      window.moodStudio.render();
    }
    if (window.forgottenGems) {
      window.forgottenGems.render();
    }

    this.updateActiveTitleAnimations();
  }

  toggleCardPlay(trackId) {
    if (!window.player) return;
    const currentTrack = window.player.state.currentTrack;
    if (currentTrack && currentTrack.id === trackId) {
      window.player.togglePlay();
    } else {
      const track = window.storageService ? window.storageService.getTrackById(trackId) : null;
      if (track) {
        window.player.playTrack(track, window.storageService.getAllTracks());
      }
    }
  }

  updateCardPlayButtons() {
    const currentTrackId = window.player?.state?.currentTrack?.id;
    const isPlaying = window.player?.state?.isPlaying;

    document.querySelectorAll(".waven-hub-card").forEach(card => {
      const cardTrackId = card.getAttribute("data-track-id");
      const isThisPlaying = (cardTrackId === currentTrackId && isPlaying);
      const isThisSelected = (cardTrackId === currentTrackId);

      if (isThisSelected) {
        card.classList.add("active-selected");
        if (isThisPlaying) card.classList.add("active-playing");
        else card.classList.remove("active-playing");
      } else {
        card.classList.remove("active-selected", "active-playing");
      }

      const btn = card.querySelector(".hub-card-play-btn");
      if (btn) {
        if (isThisPlaying) {
          btn.classList.add("playing");
          btn.setAttribute("aria-label", "Pause");
          btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
        } else {
          btn.classList.remove("playing");
          btn.setAttribute("aria-label", "Play");
          btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`;
        }
      }
    });
  }

  updateActiveTitleAnimations() {
    const currentTrack = window.player?.state?.currentTrack;
    const currentTrackId = currentTrack?.id;

    // Remove sliding animation from any unselected tracks
    document.querySelectorAll(".selected-title-sliding").forEach(el => {
      const parentRow = el.closest("[data-track-id]");
      if (parentRow && parentRow.getAttribute("data-track-id") !== currentTrackId) {
        el.classList.remove("selected-title-sliding");
        el.style.removeProperty("--title-slide-dist");
        el.style.removeProperty("--title-slide-duration");
      }
    });

    if (!currentTrackId) return;

    // Apply slide animation ONLY to the selected music track:
    // A. Track row in tracklist
    document.querySelectorAll(`.waven-track-row[data-track-id="${currentTrackId}"]`).forEach(row => {
      const titleEl = row.querySelector(".track-row-title");
      if (titleEl) this._applySlideAnimation(titleEl);
    });

    // B. Card on Home Page
    document.querySelectorAll(`.waven-hub-card[data-track-id="${currentTrackId}"]`).forEach(card => {
      const titleEl = card.querySelector(".hub-card-title");
      if (titleEl) this._applySlideAnimation(titleEl);
    });

    // C. Hero Player Title
    const heroTitle = document.getElementById("hero-player-title");
    if (heroTitle && heroTitle.textContent !== "No Track Loaded") {
      this._applySlideAnimation(heroTitle);
    }

    // D. Mini Player Title
    const miniTitle = document.querySelector(".mini-title");
    if (miniTitle && miniTitle.textContent !== "No Track Selected") {
      this._applySlideAnimation(miniTitle);
    }

    // E. Fullscreen Modal Player Title
    const fullTitle = document.querySelector(".fullscreen-title");
    if (fullTitle && fullTitle.textContent !== "No Track Selected") {
      this._applySlideAnimation(fullTitle);
    }
  }

  _applySlideAnimation(el) {
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    parent.style.overflow = "hidden";
    parent.style.position = "relative";

    // Measure widths to determine exact slide distance
    const parentWidth = parent.clientWidth || 200;
    const textWidth = el.scrollWidth || el.clientWidth;

    // Only slide if text genuinely overflows the container
    if (textWidth > parentWidth + 6) {
      const dist = Math.ceil(textWidth - parentWidth + 28);
      // Calm, slow, readable speed: 14s to 26s total cycle duration
      const duration = Math.max(14, Math.min(26, Math.round(dist / 10 + 11)));
      el.style.setProperty("--title-slide-dist", `-${dist}px`);
      el.style.setProperty("--title-slide-duration", `${duration}s`);
      el.classList.add("selected-title-sliding");
    } else {
      // If title fits completely, keep it static and crisp
      el.classList.remove("selected-title-sliding");
      el.style.removeProperty("--title-slide-dist");
      el.style.removeProperty("--title-slide-duration");
    }
  }

  async handleTrackRowClick(trackId) {
    if (!trackId) return;
    const all = window.storageService ? window.storageService.getAllTracks() : [];
    const track = all.find(t => t.id === trackId) || (window.storageService ? window.storageService.getTrackById(trackId) : null);
    if (track && window.player) {
      window.player.playTrack(track, all.length > 0 ? all : null);
    }
  }

  async requestFolderAccess() {
    this.hideStoragePermissionModal();
    if (window.AndroidBridge && typeof window.AndroidBridge.isAndroidApp === "function") {
      if (typeof window.AndroidBridge.checkAndRequestAudioPermissions === "function") {
        window.AndroidBridge.checkAndRequestAudioPermissions();
      }
      if (typeof window.AndroidBridge.triggerDeviceScan === "function") {
        window.AndroidBridge.triggerDeviceScan();
      }
      return;
    }
    if (window.importManager) {
      await window.importManager.openDirectoryPicker();
    }
  }

  requestFileAccess() {
    this.hideStoragePermissionModal();
    if (window.importManager) {
      window.importManager.triggerFilePicker();
    }
  }

  showStoragePermissionModal() {
    const modal = document.getElementById("storage-permission-modal");
    if (modal) modal.classList.add("active");
  }

  hideStoragePermissionModal() {
    const modal = document.getElementById("storage-permission-modal");
    if (modal) modal.classList.remove("active");
  }

  toggleTrackFavourite(trackId, btn) {
    if (window.storageService) {
      const isLiked = window.storageService.isLiked(trackId);
      let newLikedState = !isLiked;
      if (isLiked) {
        window.storageService.removeFromLiked(trackId);
        if (btn) {
          btn.classList.remove('active');
          btn.querySelector('svg')?.setAttribute('fill', 'none');
          btn.querySelector('svg')?.setAttribute('stroke', 'currentColor');
        }
      } else {
        window.storageService.addToLiked(trackId);
        if (btn) {
          btn.classList.add('active');
          btn.querySelector('svg')?.setAttribute('fill', '#ef4444');
          btn.querySelector('svg')?.setAttribute('stroke', '#ef4444');
        }
      }
      if (window.player && window.player.state.currentTrack?.id === trackId) {
        window.player.updateHeartUI(newLikedState);
      }
      window.dispatchEvent(new CustomEvent("ar7:liked_updated", { detail: { trackId, isLiked: newLikedState } }));
    } else if (btn) {
      btn.classList.toggle('active');
    }
  }

  // -------------------------------------------------------------
  // CONTROLS & EVENT BINDINGS
  // -------------------------------------------------------------

  _bindPlayerUI() {
    // Play/Pause buttons
    document.querySelectorAll(".play-toggle-btn").forEach(btn => {
      if (!btn.hasAttribute("onclick")) {
        btn.addEventListener("click", () => {
          if (window.player) window.player.togglePlay();
        });
      }
    });

    // Prev buttons
    document.querySelectorAll(".btn-prev-track").forEach(btn => {
      btn.addEventListener("click", () => {
        if (window.player) window.player.previous();
      });
    });

    // Next buttons
    document.querySelectorAll(".btn-next-track").forEach(btn => {
      btn.addEventListener("click", () => {
        if (window.player) window.player.next();
      });
    });

    // Shuffle buttons
    document.querySelectorAll(".btn-shuffle-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        if (window.player) window.player.toggleShuffle();
      });
    });

    // Repeat buttons
    document.querySelectorAll(".btn-repeat-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        if (window.player) window.player.toggleRepeat();
      });
    });

    // Mute buttons
    document.querySelectorAll(".btn-mute-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        if (window.player) window.player.toggleMute();
      });
    });

    // Heart buttons
    document.querySelectorAll(".player-heart-btn, .mini-heart-btn").forEach(btn => {
      if (!btn.hasAttribute("onclick")) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (window.player) {
            window.player.toggleLike();
          }
        });
      }
    });

    // Queue Toggle buttons
    document.querySelectorAll(".queue-toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.toggleQueueDrawer();
      });
    });

    const closeQueueBtn = document.getElementById("queue-close-btn");
    if (closeQueueBtn) {
      closeQueueBtn.addEventListener("click", () => {
        const drawer = document.getElementById("queue-drawer");
        if (drawer) drawer.classList.remove("active");
      });
    }

    const clearQueueBtn = document.getElementById("queue-clear-all-btn");
    if (clearQueueBtn) {
      clearQueueBtn.addEventListener("click", () => {
        if (window.queueManager) window.queueManager.clearQueue();
      });
    }

    // Fullscreen / Immersive Mobile Player Modal
    document.querySelectorAll(".expand-now-playing-trigger, .mini-player-container").forEach(el => {
      el.addEventListener("click", (e) => {
        // If clicking heart, play toggle, or playback controls, don't trigger expand
        if (e.target.closest(".player-heart-btn") || e.target.closest(".play-toggle-btn") || e.target.closest(".ctrl-btn")) return;
        this.openFullscreenPlayer();
      });
    });

    const closeFullscreenBtn = document.getElementById("fullscreen-player-close");
    if (closeFullscreenBtn) {
      closeFullscreenBtn.addEventListener("click", () => {
        this.closeFullscreenPlayer();
      });
    }
  }

  _bindSeekAndVolumeSliders() {
    // 1. Seek Bars with Smooth Scrubbing Preview & Commit on Release
    document.querySelectorAll(".seek-bar-track").forEach(track => {
      let isSeeking = false;
      let lastFraction = 0;
      let lastTouchTime = 0;

      const getSeekFraction = (e) => {
        const rect = track.getBoundingClientRect();
        if (!rect || rect.width <= 0) return null;
        const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
        let clientX = null;
        if (touch && typeof touch.clientX === "number") {
          clientX = touch.clientX;
        } else if (typeof e.clientX === "number" && !isNaN(e.clientX)) {
          clientX = e.clientX;
        }
        if (clientX === null) return null;
        return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
      };

      const updateVisualPreview = (fraction) => {
        track.querySelectorAll(".seek-bar-fill").forEach(el => el.style.width = `${fraction * 100}%`);
        track.querySelectorAll(".seek-bar-thumb").forEach(el => el.style.left = `${fraction * 100}%`);
        if (window.player) {
          const dur = window.player.state.duration || (window.player.audio && isFinite(window.player.audio.duration) ? window.player.audio.duration : 0);
          const formatted = window.player.formatTime(fraction * dur);
          track.closest(".player-seek-row, .modal-seek-row, .immersive-seek-row, .player-card-seek-box, .progress-container")
            ?.querySelectorAll(".time-stamp.current, #immersive-time-current")
            ?.forEach(el => el.textContent = formatted);
        }
      };

      // Desktop mouse events (ignores synthetic mouse events following touch)
      track.addEventListener("mousedown", (e) => {
        if (Date.now() - lastTouchTime < 800) {
          e.preventDefault();
          return;
        }
        isSeeking = true;
        if (window.player) window.player.startScrubbing();
        const initialF = getSeekFraction(e);
        if (initialF !== null) {
          lastFraction = initialF;
          updateVisualPreview(initialF);
        }

        const onMouseMove = (moveEvent) => {
          if (!isSeeking) return;
          const f = getSeekFraction(moveEvent);
          if (f !== null) {
            lastFraction = f;
            updateVisualPreview(f);
          }
        };

        const onMouseUp = (upEvent) => {
          if (isSeeking) {
            isSeeking = false;
            const f = getSeekFraction(upEvent);
            const target = (f !== null) ? f : lastFraction;
            if (window.player && target !== null) {
              window.player.endScrubbing(target);
            }
          }
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      // Mobile Touch events
      track.addEventListener("touchstart", (e) => {
        lastTouchTime = Date.now();
        isSeeking = true;
        if (window.player) window.player.startScrubbing();
        const initialF = getSeekFraction(e);
        if (initialF !== null) {
          lastFraction = initialF;
          updateVisualPreview(initialF);
        }

        const onTouchMove = (moveEvent) => {
          lastTouchTime = Date.now();
          if (!isSeeking) return;
          if (moveEvent.cancelable) {
            moveEvent.preventDefault();
          }
          const f = getSeekFraction(moveEvent);
          if (f !== null) {
            lastFraction = f;
            updateVisualPreview(f);
          }
        };

        const onTouchEnd = (endEvent) => {
          lastTouchTime = Date.now();
          if (endEvent.cancelable) {
            endEvent.preventDefault();
          }
          if (isSeeking) {
            isSeeking = false;
            const f = getSeekFraction(endEvent);
            const target = (f !== null) ? f : lastFraction;
            if (window.player && target !== null) {
              window.player.endScrubbing(target);
            }
          }
          window.removeEventListener("touchmove", onTouchMove);
          window.removeEventListener("touchend", onTouchEnd);
          window.removeEventListener("touchcancel", onTouchEnd);
        };

        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd, { passive: false });
        window.addEventListener("touchcancel", onTouchEnd, { passive: false });
      }, { passive: false });
    });

    // 2. Volume Sliders
    document.querySelectorAll(".volume-slider-track").forEach(track => {
      let isAdjusting = false;
      let lastTouchTime = 0;

      const getVolumeFraction = (e) => {
        const rect = track.getBoundingClientRect();
        if (!rect || rect.width <= 0) return 0.5;
        const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
        let clientX = null;
        if (touch && typeof touch.clientX === "number") {
          clientX = touch.clientX;
        } else if (typeof e.clientX === "number" && !isNaN(e.clientX)) {
          clientX = e.clientX;
        }
        if (clientX === null) return 0.5;
        return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
      };

      track.addEventListener("mousedown", (e) => {
        if (Date.now() - lastTouchTime < 800) {
          e.preventDefault();
          return;
        }
        isAdjusting = true;
        const f = getVolumeFraction(e);
        if (window.player) window.player.setVolume(f);

        const onMouseMove = (moveEvent) => {
          if (!isAdjusting) return;
          const vol = getVolumeFraction(moveEvent);
          if (window.player) window.player.setVolume(vol);
        };

        const onMouseUp = () => {
          isAdjusting = false;
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });

      track.addEventListener("touchstart", (e) => {
        lastTouchTime = Date.now();
        isAdjusting = true;
        const f = getVolumeFraction(e);
        if (window.player) window.player.setVolume(f);

        const onTouchMove = (moveEvent) => {
          lastTouchTime = Date.now();
          if (!isAdjusting) return;
          if (moveEvent.cancelable) moveEvent.preventDefault();
          const vol = getVolumeFraction(moveEvent);
          if (window.player) window.player.setVolume(vol);
        };

        const onTouchEnd = (endEvent) => {
          lastTouchTime = Date.now();
          if (endEvent.cancelable) endEvent.preventDefault();
          isAdjusting = false;
          window.removeEventListener("touchmove", onTouchMove);
          window.removeEventListener("touchend", onTouchEnd);
          window.removeEventListener("touchcancel", onTouchEnd);
        };

        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd, { passive: false });
        window.addEventListener("touchcancel", onTouchEnd, { passive: false });
      }, { passive: false });
    });
  }

  _bindKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // Ignore if user is typing in an input field
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.code === "Space") {
        e.preventDefault();
        if (window.player) window.player.togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (window.player) window.player.seek((window.player.state.currentTime || 0) - 5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (window.player) window.player.seek((window.player.state.currentTime || 0) + 5);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        if (window.player) window.player.setVolume((window.player.state.volume || 0.85) + 0.05);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        if (window.player) window.player.setVolume((window.player.state.volume || 0.85) - 0.05);
      } else if (e.key === "m" || e.key === "M") {
        if (window.player) window.player.toggleMute();
      } else if (e.key === "s" || e.key === "S") {
        if (window.player) window.player.toggleShuffle();
      } else if (e.key === "r" || e.key === "R") {
        if (window.player) window.player.toggleRepeat();
      } else if (e.key === "n" || e.key === "N") {
        if (window.player) window.player.next();
      } else if (e.key === "p" || e.key === "P") {
        if (window.player) window.player.previous();
      }
    });
  }

  _bindGlobalEvents() {
    window.addEventListener("ar7:library_updated", () => {
      this.loadHomeFeeds();
      this._syncInitialHeroPlayer();
    });

    window.addEventListener("ar7:history_updated", () => {
      if (window.navigation?.currentView === "home") {
        this.loadHomeFeeds();
      }
    });

    window.addEventListener("ar7:liked_updated", () => {
      if (window.player) {
        window.player.updateHeartUI();
      }
      if (window.navigation?.currentView === "home") {
        this.loadHomeFeeds();
      }
      if (window.navigation?.currentView === "liked" && window.libraryManager) {
        window.libraryManager.renderLikedSongsView();
      }
    });

    window.addEventListener("ar7:player_state_changed", () => {
      this.updateCardPlayButtons();
      this.updateActiveTitleAnimations();
    });

    window.addEventListener("resize", () => {
      if (this._titleResizeTimer) clearTimeout(this._titleResizeTimer);
      this._titleResizeTimer = setTimeout(() => this.updateActiveTitleAnimations(), 200);
    });

    // Close context menu on outside click
    document.addEventListener("click", () => {
      this.closeContextMenu();
    });

    // Prevent sticky hover and stuck focus on touch devices
    document.addEventListener("touchend", (e) => {
      const btn = e.target.closest("button, .btn, .ctrl-btn, .glass-round-btn, .dock-item, .capsule-nav-item, .subnav-pill, .waven-big-play-btn, .mini-play-btn, .library-action-btn");
      if (btn) {
        setTimeout(() => {
          if (document.activeElement === btn) {
            btn.blur();
          }
        }, 80);
      }
    }, { passive: true });

    // Tab buttons in Desktop Now Playing Panel ('Player' vs 'Queue')
    document.querySelectorAll(".panel-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        document.querySelectorAll(".panel-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const playerTab = document.getElementById("panel-tab-player");
        const queueTab = document.getElementById("panel-tab-queue");
        if (tab === "queue") {
          if (playerTab) playerTab.style.display = "none";
          if (queueTab) queueTab.style.display = "block";
          if (window.queueManager) window.queueManager.render();
        } else {
          if (playerTab) playerTab.style.display = "flex";
          if (queueTab) queueTab.style.display = "none";
        }
      });
    });
  }

  // -------------------------------------------------------------
  // CONTEXT MENU
  // -------------------------------------------------------------

  openContextMenu(e, trackId) {
    e.stopPropagation();
    const track = window.storageService?.getTrackById(trackId);
    if (!track) return;

    this.selectedContextMenuTrack = track;
    const menu = document.getElementById("app-context-menu");
    if (!menu) return;

    menu.style.display = "block";
    menu.style.left = `${Math.min(e.clientX, window.innerWidth - 220)}px`;
    menu.style.top = `${Math.min(e.clientY, window.innerHeight - 260)}px`;
  }

  closeContextMenu() {
    const menu = document.getElementById("app-context-menu");
    if (menu) menu.style.display = "none";
  }

  handleContextMenuAction(action) {
    const track = this.selectedContextMenuTrack;
    this.closeContextMenu();
    if (!track) return;

    if (action === "play") {
      if (window.player) window.player.playTrack(track);
    } else if (action === "play_next") {
      if (window.queueManager) window.queueManager.playNext(track);
    } else if (action === "add_queue") {
      if (window.queueManager) window.queueManager.addToQueue(track);
    } else if (action === "add_playlist") {
      if (window.playlistsManager) window.playlistsManager.openAddToPlaylistModal(track);
    } else if (action === "like") {
      if (window.storageService) window.storageService.toggleLike(track);
    } else if (action === "view_artist") {
      if (window.navigation) window.navigation.navigateTo("artist", encodeURIComponent(track.artist));
    } else if (action === "view_album") {
      if (window.navigation) window.navigation.navigateTo("album", encodeURIComponent(track.album || "Local Music"));
    } else if (action === "edit_tags") {
      if (window.organizerManager) window.organizerManager.openTrackEditor(track.id);
    } else if (action === "edit_lyrics") {
      if (window.lyricsManager) {
        window.lyricsManager.loadTrackLyrics(track);
        window.lyricsManager.openEditor();
      }
    } else if (action === "delete") {
      if (confirm(`Remove "${track.title}" from your library? (The original file on your computer will not be deleted)`)) {
        if (window.storageService) window.storageService.deleteTrack(track.id);
        this.showToast(`Removed "${track.title}" from library`, "info");
      }
    }
  }

  // -------------------------------------------------------------
  // MODALS & DRAWERS
  // -------------------------------------------------------------

  toggleQueueDrawer() {
    const drawer = document.getElementById("queue-drawer");
    if (!drawer) return;
    drawer.classList.toggle("active");
    if (drawer.classList.contains("active") && window.queueManager) {
      window.queueManager.render();
    }
  }

  openFullscreenPlayer() {
    if (window.immersiveManager) {
      window.immersiveManager.open();
    } else {
      const modal = document.getElementById("fullscreen-player-modal");
      if (modal) modal.classList.add("active");
    }
  }

  closeFullscreenPlayer() {
    if (window.immersiveManager && window.immersiveManager.isActive) {
      window.immersiveManager.close();
    }
    const modal = document.getElementById("fullscreen-player-modal");
    if (modal) modal.classList.remove("active");
  }

  showToast(message, type = "info") {
    // Suppress intrusive popups on button clicks as requested
    console.log(`[WAVEN ${type}]:`, message);
  }

  // -------------------------------------------------------------
  // SETTINGS VIEW
  // -------------------------------------------------------------

  renderSettingsView() {
    const container = document.getElementById("settings-view-content");
    if (!container) return;

    const settings = window.storageService ? window.storageService.getSettings() : {};
    const tracks = window.storageService ? window.storageService.getAllTracks() : [];
    const totalBytes = tracks.reduce((a, b) => a + (b.fileSize || 0), 0);
    const mbStr = (totalBytes / (1024 * 1024)).toFixed(1);

    const streamQuality = settings.streamQuality || "flac";
    const cacheStreams = settings.cacheStreams !== false;
    const crossfade = settings.crossfade || 0;
    const normalize = Boolean(settings.normalize);

    container.innerHTML = `
      <div class="library-header-bar">
        <div>
          <h1 class="view-main-title">Settings & Preferences</h1>
          <p class="view-main-subtitle">Audio engine, local sandbox storage, and future online music streaming architecture</p>
        </div>
      </div>

      <div class="settings-view-container">
        <!-- 1. FEATURED: FUTURE ONLINE MUSIC STREAMING ARCHITECTURE -->
        <div class="settings-hero-card">
          <div class="settings-hero-header">
            <div class="settings-hero-title-group">
              <div class="streaming-pill-badge">
                <span class="streaming-pill-pulse"></span>
                <span>ARCHITECTURE READY • UPCOMING STAGE 2</span>
              </div>
              <h2 class="settings-hero-title">Online Music Streaming Integration</h2>
              <p class="settings-hero-desc">
                WAVEN is engineered with a modular <strong>AudioSourceResolver</strong> abstraction layer. While currently operating in 100% private <strong>Local-First Mode</strong> (playing your device's audio files offline), the playback pipeline, queue manager, and UI architecture are fully ready to seamlessly connect with legitimate online streaming platforms (Audius, Jamendo, Spotify Web Playback SDK, or custom Subsonic/Jellyfin music servers) in the upcoming stage without rebuilding the application.
              </p>
            </div>
          </div>

          <div class="streaming-arch-diagram">
            <div class="arch-node active">
              <span class="arch-node-status">ACTIVE NOW</span>
              <span class="arch-node-icon">💾</span>
              <span class="arch-node-title">Local Audio Engine</span>
              <span class="arch-node-sub">IndexedDB &amp; Local Files</span>
            </div>
            <div class="arch-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
            <div class="arch-node core">
              <span class="arch-node-status">CORE</span>
              <span class="arch-node-icon">⚡</span>
              <span class="arch-node-title">AudioSourceResolver</span>
              <span class="arch-node-sub">Universal Stream Pipeline</span>
            </div>
            <div class="arch-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
            <div class="arch-node upcoming">
              <span class="arch-node-status">STAGE 2 READY</span>
              <span class="arch-node-icon">🌐</span>
              <span class="arch-node-title">Online Music Stream</span>
              <span class="arch-node-sub">Audius / Jamendo / Spotify API</span>
            </div>
          </div>

          <!-- Architecture & Upcoming Streaming Controls -->
          <div class="streaming-options-grid">
            <div class="streaming-opt-box">
              <div class="opt-box-info">
                <span class="opt-box-label">Streaming Audio Quality Target</span>
                <span class="opt-box-hint">Default bitrate when connected to legitimate online streaming</span>
              </div>
              <div class="settings-pill-selector">
                <button class="pill-choice ${streamQuality === 'flac' ? 'active' : ''}" onclick="window.app.setStreamingQuality('flac')">Lossless FLAC</button>
                <button class="pill-choice ${streamQuality === '320' ? 'active' : ''}" onclick="window.app.setStreamingQuality('320')">320 kbps AAC</button>
                <button class="pill-choice ${streamQuality === '192' ? 'active' : ''}" onclick="window.app.setStreamingQuality('192')">192 kbps MP3</button>
              </div>
            </div>

            <div class="streaming-opt-box">
              <div class="opt-box-info">
                <span class="opt-box-label">Local Stream Cache</span>
                <span class="opt-box-hint">Cache online streamed songs into IndexedDB for instant offline replay</span>
              </div>
              <label class="modern-switch">
                <input type="checkbox" id="stream-cache-toggle" ${cacheStreams ? 'checked' : ''} onchange="window.app.toggleStreamingCache(this.checked)">
                <span class="slider-round"></span>
              </label>
            </div>

            <div class="streaming-opt-box">
              <div class="opt-box-info">
                <span class="opt-box-label">Provider Connection Status</span>
                <span class="opt-box-hint">Current audio stream bridge resolver protocol</span>
              </div>
              <div class="status-ready-pill">
                <span class="status-dot-green"></span>
                <span>Resolver Standby • Ready for API Token</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. LOCAL STORAGE & LIBRARY MANAGEMENT -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div>
              <h3 class="settings-card-title">Local IndexedDB Database &amp; Storage</h3>
              <p class="settings-card-desc">Audio files, extracted ID3 tags, and artwork are stored safely inside your browser's private sandbox</p>
            </div>
          </div>
          <div class="settings-stats-row">
            <div class="stat-pill-item">
              <span class="stat-pill-num">${tracks.length}</span>
              <span class="stat-pill-label">Total Songs</span>
            </div>
            <div class="stat-pill-item">
              <span class="stat-pill-num">${mbStr} MB</span>
              <span class="stat-pill-label">IndexedDB Size</span>
            </div>
            <div class="stat-pill-item">
              <span class="stat-pill-num">100%</span>
              <span class="stat-pill-label">Local Offline</span>
            </div>
          </div>
          <div style="display: flex; gap: 12px; margin-top: 18px; flex-wrap: wrap;">
            <button class="btn-primary" onclick="if (window.organizerManager) window.organizerManager.openToolsModal();" style="display: flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Smart Library Organizer &amp; Duplicates
            </button>
            <button class="btn-secondary" onclick="window.importManager.triggerFilePicker()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Select Audio Files
            </button>
            <button class="btn-secondary" onclick="window.app.requestFolderAccess()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Rescan Music Folder
            </button>
            <button class="btn-secondary" style="color: var(--accent-danger); border-color: rgba(239,68,68,0.3);" onclick="window.app.clearAllDataPrompt(this)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Clear Library Cache
            </button>
          </div>
        </div>

        <!-- 3. AUDIO PLAYBACK ENGINE -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div>
              <h3 class="settings-card-title">Audio Engine &amp; Playback</h3>
              <p class="settings-card-desc">DSP processing, crossfade timing, and volume leveling</p>
            </div>
          </div>
          <div class="streaming-options-grid" style="margin-top: 16px;">
            <div class="streaming-opt-box">
              <div class="opt-box-info">
                <span class="opt-box-label">Crossfade Between Tracks</span>
                <span class="opt-box-hint">Smooth overlap transition during track change</span>
              </div>
              <div class="settings-pill-selector">
                <button class="pill-choice ${crossfade === 0 ? 'active' : ''}" onclick="window.app.setCrossfade(0)">Off</button>
                <button class="pill-choice ${crossfade === 2 ? 'active' : ''}" onclick="window.app.setCrossfade(2)">2s</button>
                <button class="pill-choice ${crossfade === 4 ? 'active' : ''}" onclick="window.app.setCrossfade(4)">4s</button>
                <button class="pill-choice ${crossfade === 6 ? 'active' : ''}" onclick="window.app.setCrossfade(6)">6s</button>
              </div>
            </div>

            <div class="streaming-opt-box">
              <div class="opt-box-info">
                <span class="opt-box-label">Volume Normalization (EBU R128)</span>
                <span class="opt-box-hint">Prevents sudden loud changes across diverse audio formats</span>
              </div>
              <label class="modern-switch">
                <input type="checkbox" id="normalize-toggle" ${normalize ? 'checked' : ''} onchange="window.app.toggleNormalization(this.checked)">
                <span class="slider-round"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 4. VISUAL THEME -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div>
              <h3 class="settings-card-title">Color Palette Theme</h3>
              <p class="settings-card-desc">Choose your preferred visual aesthetic</p>
            </div>
          </div>
          <div style="display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap;">
            <button class="btn-secondary ${(!settings.theme || settings.theme === 'dark') ? 'active' : ''}" onclick="window.app.setTheme('dark')">
              Charcoal Dark (Default)
            </button>
            <button class="btn-secondary ${settings.theme === 'midnight' ? 'active' : ''}" onclick="window.app.setTheme('midnight')">
              Midnight Blue
            </button>
            <button class="btn-secondary ${settings.theme === 'obsidian' ? 'active' : ''}" onclick="window.app.setTheme('obsidian')">
              Obsidian Amber
            </button>
            <button class="btn-secondary ${settings.theme === 'emerald' ? 'active' : ''}" onclick="window.app.setTheme('emerald')">
              Emerald Forest
            </button>
          </div>
        </div>

        <!-- 5. PRIVACY & SECURITY -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div>
              <h3 class="settings-card-title">Privacy &amp; Local Playback Assurance</h3>
              <p class="settings-card-desc">100% offline-first security guarantee</p>
            </div>
          </div>
          <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.6; margin-top: 10px;">
            WAVEN operates strictly on your local device. Local audio files are read directly via HTML5 File System Access and IndexedDB sandbox. They are never uploaded to any remote server or third party. When online streaming is connected in Stage 2, it will only request the streams you explicitly choose to play.
          </p>
        </div>
      </div>
    `;
  }

  setStreamingQuality(quality) {
    const labels = {
      flac: "Lossless FLAC",
      "320": "320 kbps AAC",
      "192": "192 kbps MP3"
    };
    if (window.storageService) {
      window.storageService.saveSettings({ streamQuality: quality });
    }
    this.renderSettingsView();
    this.showToast(`Streaming target: ${labels[quality] || quality}`, "success");
  }

  toggleStreamingCache(enabled) {
    if (window.storageService) {
      window.storageService.saveSettings({ cacheStreams: enabled });
    }
    this.showToast(enabled ? "Local stream caching enabled" : "Local stream caching disabled", "info");
  }

  setCrossfade(seconds) {
    const s = Number(seconds) || 0;
    if (window.storageService) {
      window.storageService.saveSettings({ crossfade: s });
    }
    if (window.player && typeof window.player.setCrossfade === "function") {
      window.player.setCrossfade(s);
    }
    this.renderSettingsView();
    this.showToast(s > 0 ? `Track crossfade set to ${s}s` : "Track crossfade turned off", "success");
  }

  toggleNormalization(enabled) {
    if (window.storageService) {
      window.storageService.saveSettings({ normalize: enabled });
    }
    if (window.player && typeof window.player.setNormalization === "function") {
      window.player.setNormalization(enabled);
    }
    this.showToast(enabled ? "Volume normalization active (EBU R128)" : "Volume normalization turned off", "info");
  }

  setTheme(themeName) {
    document.documentElement.setAttribute("data-theme", themeName);
    if (document.body) document.body.setAttribute("data-theme", themeName);
    if (window.storageService) {
      window.storageService.saveSettings({ theme: themeName });
    }
    this.renderSettingsView();
    const themeLabels = {
      dark: "Charcoal Dark",
      midnight: "Midnight Blue",
      obsidian: "Obsidian Amber",
      emerald: "Emerald Forest"
    };
    this.showToast(`Theme switched to ${themeLabels[themeName] || themeName}`, "success");
  }

  clearAllDataPrompt(btn = null) {
    if (this._confirmingClearAll) {
      this._confirmingClearAll = false;
      if (window.indexedDB) {
        window.indexedDB.deleteDatabase("AR7_LocalMusicDB");
      }
      localStorage.clear();
      this.showToast("Library cleared. Refreshing app...", "info");
      setTimeout(() => location.reload(), 800);
      return;
    }

    this._confirmingClearAll = true;
    if (btn) {
      btn.innerHTML = `<span style="color: #ef4444; font-weight: 700;">Tap Again to Confirm Clear</span>`;
      btn.style.borderColor = "rgba(239, 68, 68, 0.8)";
      setTimeout(() => {
        this._confirmingClearAll = false;
        if (btn && btn.isConnected) {
          btn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Clear Library Cache
          `;
          btn.style.borderColor = "";
        }
      }, 4000);
    }
    this.showToast("Tap 'Confirm Clear' within 4s to reset library", "info");
  }
}

window.app = new AppController();

// Boot application when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.app.init());
} else {
  window.app.init();
}

// Global hook called by Android native WebView when MediaStore scan finishes
window.onNativeSongsScanned = function() {
  if (window.app && typeof window.app.checkAndLoadAndroidDeviceSongs === "function") {
    window.app.checkAndLoadAndroidDeviceSongs();
  }
};
