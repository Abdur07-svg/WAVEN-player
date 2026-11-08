/**
 * WAVEN — PLAYLISTS MANAGER
 * Curated playlists, custom playlist creation, deletion, track addition,
 * and luxury glassmorphic playlist views.
 */

class PlaylistsManager {
  constructor() {
    this.currentPlaylistId = null;
    this.selectedTrackForAdd = null;
  }

  init() {
    window.addEventListener("ar7:playlists_updated", () => {
      this.renderSidebarPlaylists();
      if (this.currentPlaylistId && window.navigation?.currentView === "playlist") {
        this.renderPlaylistDetails(this.currentPlaylistId);
      }
    });

    this.renderSidebarPlaylists();
  }

  renderSidebarPlaylists() {
    const sidebarList = document.getElementById("sidebar-playlists-list");
    if (!sidebarList) return;

    const playlists = window.storageService ? window.storageService.getPlaylists() : [];

    if (playlists.length === 0) {
      sidebarList.innerHTML = `<div style="font-size: 0.78rem; color: #8b92a4; padding: 8px 12px;">No custom playlists</div>`;
      return;
    }

    sidebarList.innerHTML = playlists.map(pl => `
      <div class="playlist-link" onclick="window.navigation.navigateTo('playlist', '${pl.id}')" title="${pl.name}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pl.name}</span>
      </div>
    `).join("");
  }

  openCreateModal() {
    const modal = document.getElementById("create-playlist-modal");
    const nameInput = document.getElementById("playlist-name-input");
    const descInput = document.getElementById("playlist-desc-input");
    if (!modal) return;

    if (nameInput) nameInput.value = "";
    if (descInput) descInput.value = "";

    modal.classList.add("active");
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
  }

  closeCreateModal() {
    const modal = document.getElementById("create-playlist-modal");
    if (modal) modal.classList.remove("active");
  }

  async handleCreateSubmit(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById("playlist-name-input");
    const descInput = document.getElementById("playlist-desc-input");
    const name = nameInput ? nameInput.value.trim() : "";
    const desc = descInput ? descInput.value.trim() : "";

    if (!name) {
      if (window.app) window.app.showToast("Please enter a playlist name", "error");
      return;
    }

    const newPl = await window.storageService.createPlaylist(name, desc);
    this.closeCreateModal();

    if (window.app) window.app.showToast(`Playlist "${newPl.name}" created!`, "success");
    window.navigation.navigateTo("playlist", newPl.id);
  }

  openAddToPlaylistModal(track) {
    this.selectedTrackForAdd = track;
    const modal = document.getElementById("add-to-playlist-modal");
    const listContainer = document.getElementById("add-playlist-options-list");
    if (!modal || !listContainer) return;

    const playlists = window.storageService ? window.storageService.getPlaylists() : [];

    if (playlists.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #8b92a4;">
          <p style="margin-bottom: 12px;">No custom playlists yet.</p>
          <button class="btn-primary" style="font-size: 0.85rem;" onclick="window.playlistsManager.closeAddToPlaylistModal(); window.playlistsManager.openCreateModal();">Create Playlist</button>
        </div>
      `;
    } else {
      listContainer.innerHTML = playlists.map(pl => {
        const hasTrack = pl.tracks.some(t => t.id === track.id);
        return `
          <div class="context-item" style="justify-content: space-between; padding: 12px 14px;" onclick="window.playlistsManager.toggleTrackInPlaylist('${pl.id}')">
            <span style="font-weight: 500;">${pl.name} (${pl.tracks.length})</span>
            <span style="font-size: 0.8rem; color: ${hasTrack ? '#10b981' : '#8b92a4'};">
              ${hasTrack ? '✓ Added' : '+ Add'}
            </span>
          </div>
        `;
      }).join("");
    }

    modal.classList.add("active");
  }

  closeAddToPlaylistModal() {
    const modal = document.getElementById("add-to-playlist-modal");
    if (modal) modal.classList.remove("active");
    this.selectedTrackForAdd = null;
  }

  async toggleTrackInPlaylist(playlistId) {
    if (!this.selectedTrackForAdd) return;
    const playlists = window.storageService.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;

    const hasTrack = pl.tracks.some(t => t.id === this.selectedTrackForAdd.id);

    if (hasTrack) {
      await window.storageService.removeTrackFromPlaylist(playlistId, this.selectedTrackForAdd.id);
      if (window.app) window.app.showToast(`Removed from "${pl.name}"`, "info");
    } else {
      await window.storageService.addTrackToPlaylist(playlistId, this.selectedTrackForAdd.id);
      if (window.app) window.app.showToast(`Added to "${pl.name}"`, "success");
    }

    this.closeAddToPlaylistModal();
  }

  renderPlaylistsLanding() {
    const container = document.getElementById("playlist-view-content");
    if (!container) return;

    const curated = window.WAVEN_CATALOG ? window.WAVEN_CATALOG.playlists : [];
    const custom = window.storageService ? window.storageService.getPlaylists() : [];

    container.innerHTML = `
      <div class="waven-view-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 class="view-main-title">Playlists</h1>
          <p class="view-main-subtitle">Curated moods and your custom music collections</p>
        </div>
        <button class="btn-primary" onclick="window.playlistsManager.openCreateModal()" style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Playlist
        </button>
      </div>

      <!-- Curated Mixes -->
      <div style="margin-bottom: 32px;">
        <span style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 14px; display: block;">Curated Playlists</span>
        <div class="waven-cards-grid">
          ${curated.map(pl => `
            <div class="waven-music-card" onclick="window.navigation.navigateTo('playlist', '${pl.id}')">
              <div class="waven-card-artwork-wrap">
                <img src="${pl.artwork}" alt="${pl.name}" data-title="${pl.name}" data-artist="" onerror="window.handleTrackImgError(this)" />
                <button class="waven-card-play-btn" title="Play ${pl.name}" onclick="event.stopPropagation(); window.playlistsManager.playPlaylist('${pl.id}')">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
              </div>
              <div class="waven-card-info">
                <span class="waven-card-title">${pl.name}</span>
                <span class="waven-card-sub">${pl.description}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- User Custom Playlists -->
      <div style="margin-bottom: 32px;">
        <span style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 14px; display: block;">Your Playlists</span>
        <div class="waven-cards-grid">
          <!-- Create New Card -->
          <div class="waven-music-card create-card" onclick="window.playlistsManager.openCreateModal()" style="border: 1.5px dashed rgba(255,255,255,0.15); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; cursor: pointer; border-radius: var(--radius-lg); background: rgba(255,255,255,0.02); transition: all 0.2s;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; color: #fff;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <span style="font-size: 0.92rem; font-weight: 600; color: #fff;">Create Playlist</span>
            <span style="font-size: 0.78rem; color: #8b92a4; margin-top: 4px;">Add your favorite songs</span>
          </div>

          ${custom.map(pl => {
            const firstArt = pl.tracks.length > 0 ? (window.getTrackArtwork ? window.getTrackArtwork(pl.tracks[0]) : (pl.tracks[0].artwork || 'assets/covers/default_cover.svg')) : (window.getTrackFallbackArtwork ? window.getTrackFallbackArtwork(pl.name, "") : 'assets/covers/default_cover.svg');
            return `
              <div class="waven-music-card" onclick="window.navigation.navigateTo('playlist', '${pl.id}')">
                <div class="waven-card-artwork-wrap">
                  <img src="${firstArt}" alt="${pl.name}" data-title="${pl.name}" data-artist="" onerror="window.handleTrackImgError(this)" />
                  <button class="waven-card-play-btn" title="Play ${pl.name}" onclick="event.stopPropagation(); window.playlistsManager.playPlaylist('${pl.id}')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </button>
                </div>
                <div class="waven-card-info">
                  <span class="waven-card-title">${pl.name}</span>
                  <span class="waven-card-sub">${pl.tracks.length} song${pl.tracks.length === 1 ? '' : 's'}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  renderPlaylistDetails(playlistId) {
    if (!playlistId) {
      this.renderPlaylistsLanding();
      return;
    }

    this.currentPlaylistId = playlistId;
    const container = document.getElementById("playlist-view-content");
    if (!container) return;

    // Check catalog or user custom playlists
    let playlist = window.WAVEN_CATALOG ? window.WAVEN_CATALOG.getPlaylistById(playlistId) : null;
    if (!playlist && window.storageService) {
      const userPl = window.storageService.getPlaylists().find(p => p.id === playlistId);
      if (userPl) {
        playlist = {
          ...userPl,
          isCustom: true
        };
      }
    }

    if (!playlist) {
      this.renderPlaylistsLanding();
      return;
    }

    const tracks = playlist.tracks || (playlist.trackIds ? playlist.trackIds.map(tid => window.WAVEN_CATALOG.getTrack(tid)).filter(Boolean) : []);
    const art = playlist.artwork || (tracks.length > 0 ? (window.getTrackArtwork ? window.getTrackArtwork(tracks[0]) : (tracks[0].artwork || 'assets/covers/default_cover.svg')) : (window.getTrackFallbackArtwork ? window.getTrackFallbackArtwork(playlist.name, "") : 'assets/covers/default_cover.svg'));
    const isCustom = Boolean(playlist.isCustom);
    const currentTrackId = window.player?.state?.currentTrack?.id;

    container.innerHTML = `
      <!-- Hero Banner -->
      <div class="waven-detail-hero">
        <div class="detail-hero-art-box">
          <img src="${art}" alt="${playlist.name}" data-title="${playlist.name}" data-artist="" onerror="window.handleTrackImgError(this)" />
        </div>
        <div class="detail-hero-info">
          <span class="detail-hero-badge">PLAYLIST</span>
          <h1 class="detail-hero-title">${playlist.name}</h1>
          <p class="detail-hero-sub">${playlist.description || `${tracks.length} tracks`}</p>
          <div class="detail-hero-actions">
            ${tracks.length > 0 ? `
              <button class="btn-primary" onclick="window.playlistsManager.playPlaylist('${playlist.id}')" style="display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Play Playlist
              </button>
            ` : ''}
            <button class="btn-secondary" onclick="window.navigation.navigateTo('playlist')">
              All Playlists
            </button>
            ${isCustom ? `
              <button class="btn-secondary" onclick="window.playlistsManager.deletePlaylistPrompt('${playlist.id}')" style="color: #ef4444;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Delete
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Tracks List -->
      <div style="margin-top: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <span style="font-size: 0.95rem; font-weight: 700; color: #fff;">Tracks (${tracks.length})</span>
        </div>

        ${tracks.length === 0 ? `
          <div class="empty-state-box" style="padding: 32px 20px; text-align: center;">
            <p style="color: #8b92a4; margin-bottom: 12px;">This playlist is currently empty.</p>
            <button class="btn-primary" onclick="window.navigation.navigateTo('library')">Browse Library</button>
          </div>
        ` : `
          <div class="waven-tracklist-card">
            ${tracks.map(t => {
              const isPlayingThis = (currentTrackId === t.id);
              const isLiked = window.storageService ? window.storageService.isLiked(t.id) : false;
              const durText = t.durStr || (window.player ? window.player.formatTime(t.duration) : '3:30');
              const trackArt = window.getTrackArtwork ? window.getTrackArtwork(t) : (t.artwork || 'assets/covers/default_cover.svg');
              return `
                <div class="waven-track-row ${isPlayingThis ? 'active-playing' : ''}" data-track-id="${t.id}" onclick="window.player.playTrack(window.WAVEN_CATALOG.getTrack('${t.id}'))">
                  <div class="track-thumb-circle">
                    <img src="${trackArt}" alt="${t.title}" data-title="${t.title}" data-artist="${t.artist}" onerror="window.handleTrackImgError(this)" />
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
        `}
      </div>
    `;
  }

  playPlaylist(playlistId) {
    const pl = window.WAVEN_CATALOG ? window.WAVEN_CATALOG.getPlaylistById(playlistId) : null;
    if (!pl) return;
    const tracks = pl.tracks || (pl.trackIds ? pl.trackIds.map(tid => window.WAVEN_CATALOG.getTrack(tid)).filter(Boolean) : []);
    if (tracks.length > 0) {
      window.player.playTrack(tracks[0], tracks);
    }
  }

  async deletePlaylistPrompt(playlistId) {
    if (confirm("Are you sure you want to delete this custom playlist? (Your music files will remain safe in your library)")) {
      await window.storageService.deletePlaylist(playlistId);
      if (window.app) window.app.showToast("Playlist deleted", "info");
      this.renderPlaylistsLanding();
    }
  }
}

window.playlistsManager = new PlaylistsManager();
