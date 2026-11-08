/**
 * WAVEN — FORGOTTEN GEMS
 * Rediscover music in your local collection that you haven't played recently.
 * Powered by genuine IndexedDB listening timestamps.
 */

class ForgottenGemsManager {
  constructor() {
    this.activeTab = "30"; // "30" | "60" | "90" | "favourites" | "unplayed"
  }

  init() {
    window.addEventListener("ar7:history_updated", () => this.render());
    window.addEventListener("ar7:forgotten_updated", () => this.render());
  }

  setTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  getCurrentTracks() {
    if (!window.storageService) return [];
    const data = window.storageService.getForgottenGems();

    switch (this.activeTab) {
      case "30":
        return data.thirtyDays;
      case "60":
        return data.sixtyDays;
      case "90":
        return data.ninetyDays;
      case "favourites":
        return data.dormantFavourites;
      case "unplayed":
        return data.neverPlayed;
      default:
        return data.thirtyDays;
    }
  }

  playAllCurrent() {
    const tracks = this.getCurrentTracks();
    if (tracks.length === 0) {
      if (window.app) window.app.showToast("No forgotten songs in this category to play.", "info");
      return;
    }
    if (window.player) {
      window.player.playTrack(tracks[0], tracks);
      if (window.app) {
        window.app.showToast(`Playing ${tracks.length} Forgotten Gems`, "success");
      }
    }
  }

  excludeTrack(trackId, title) {
    if (window.storageService) {
      window.storageService.excludeFromForgottenGems(trackId);
      if (window.app) {
        window.app.showToast(`Excluded "${title || 'Track'}" from Forgotten Gems`, "info");
      }
    }
  }

  addToPlaylistPrompt(trackId) {
    if (window.playlistsManager) {
      window.playlistsManager.openAddToPlaylistModal(trackId);
    }
  }

  render() {
    const container = document.getElementById("forgotten-gems-container");
    if (!container) return;

    if (!window.storageService) {
      container.innerHTML = "";
      return;
    }

    const allTracks = window.storageService.getAllTracks();
    if (allTracks.length === 0) {
      container.innerHTML = "";
      return;
    }

    const data = window.storageService.getForgottenGems();
    const tracks = this.getCurrentTracks();

    const tabsConfig = [
      { id: "30", label: "30+ Days", count: data.thirtyDays.length },
      { id: "60", label: "60+ Days", count: data.sixtyDays.length },
      { id: "90", label: "90+ Days", count: data.ninetyDays.length },
      { id: "favourites", label: "Dormant Faves", count: data.dormantFavourites.length },
      { id: "unplayed", label: "Unplayed Gems", count: data.neverPlayed.length }
    ];

    const tabButtons = tabsConfig.map(tc => `
      <button class="gems-tab-btn ${this.activeTab === tc.id ? 'active' : ''}" onclick="window.forgottenGems.setTab('${tc.id}')">
        <span>${tc.label}</span>
        ${tc.count > 0 ? `<span class="gems-tab-badge">${tc.count}</span>` : ''}
      </button>
    `).join("");

    let contentHtml = "";

    if (tracks.length === 0) {
      contentHtml = `
        <div class="gems-empty-state">
          <div class="gems-empty-icon">💎</div>
          <h4 class="gems-empty-title">All caught up!</h4>
          <p class="gems-empty-desc">
            ${this.activeTab === 'unplayed'
              ? 'You have explored all the songs currently in your local collection!'
              : 'None of your tracks match this dormant threshold. Keep enjoying your music!'}
          </p>
        </div>
      `;
    } else {
      const rows = tracks.slice(0, 6).map(t => {
        const art = window.getTrackArtwork ? window.getTrackArtwork(t) : (t.artwork || "assets/covers/default_cover.svg");
        const durStr = window.libraryManager ? window.libraryManager.formatDuration(t.duration || 0) : "0:00";
        const plays = t.playCount || 0;
        const lastPlayedStr = t.lastPlayed
          ? Math.floor((Date.now() - t.lastPlayed) / (24 * 60 * 60 * 1000)) + "d ago"
          : "Never";

        return `
          <div class="gem-track-card" onclick="window.player.playTrack(window.storageService.getTrackById('${t.id}'), window.storageService.getAllTracks())">
            <div class="gem-art-box">
              <img src="${art}" alt="${t.title}" data-title="${t.title}" data-artist="${t.artist}" onerror="window.handleTrackImgError(this)" />
              <div class="gem-play-overlay">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
              </div>
            </div>
            <div class="gem-meta">
              <span class="gem-title" title="${t.title}">${t.title || 'Unknown Title'}</span>
              <span class="gem-artist">${t.artist || 'Local Audio'}</span>
              <div class="gem-status-row">
                <span class="gem-stat-chip">${this.activeTab === 'unplayed' ? 'Unplayed' : `Last: ${lastPlayedStr}`}</span>
                ${plays > 0 ? `<span class="gem-plays-chip">${plays} play${plays === 1 ? '' : 's'}</span>` : ''}
              </div>
            </div>
            <div class="gem-actions" onclick="event.stopPropagation()">
              <button class="gem-action-btn" title="Add to Playlist" onclick="window.forgottenGems.addToPlaylistPrompt('${t.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              </button>
              <button class="gem-action-btn" title="Exclude from Forgotten Gems" onclick="window.forgottenGems.excludeTrack('${t.id}', '${(t.title || '').replace(/'/g, "\\'")}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
              </button>
            </div>
          </div>
        `;
      }).join("");

      contentHtml = `
        <div class="gems-cards-grid">
          ${rows}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="forgotten-gems-wrapper">
        <div class="forgotten-gems-header">
          <div class="gems-title-group">
            <span class="gems-tag">REDISCOVER</span>
            <h3 class="gems-title">Forgotten Gems</h3>
          </div>
          <div class="gems-header-actions">
            <div class="gems-tabs-row">
              ${tabButtons}
            </div>
            ${tracks.length > 0 ? `
              <button class="btn-secondary gems-play-all-btn" onclick="window.forgottenGems.playAllCurrent()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Play All (${tracks.length})
              </button>
            ` : ''}
          </div>
        </div>
        ${contentHtml}
      </div>
    `;
  }
}

window.forgottenGems = new ForgottenGemsManager();

