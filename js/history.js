/**
 * AR7 MUSIC — PLAYBACK HISTORY VIEW
 * Verified listening history with clear and replay capabilities.
 */

class HistoryManager {
  init() {
    window.addEventListener("ar7:history_updated", () => {
      this.renderHistoryView();
    });
  }

  renderHistoryView() {
    const container = document.getElementById("history-view-content");
    if (!container) return;

    const historyItems = window.storageService ? window.storageService.getHistory() : [];
    const tracks = historyItems.map(h => h.track).filter(Boolean);

    if (tracks.length === 0) {
      container.innerHTML = `
        <div class="library-header-bar">
          <div>
            <h1 class="view-main-title">Listening History</h1>
            <p class="view-main-subtitle">Tracks you have played on AR7 Music</p>
          </div>
        </div>
        <div class="empty-state-box">
          <div class="empty-icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <h2 class="empty-title">No History Yet</h2>
          <p class="empty-desc">Songs you play will appear here automatically.</p>
          <button class="btn-primary" onclick="window.navigation.navigateTo('library')">Browse Library</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="library-header-bar">
        <div>
          <h1 class="view-main-title">Listening History</h1>
          <p class="view-main-subtitle">${tracks.length} recently played tracks</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn-primary" onclick="window.libraryManager.playTrackList(${JSON.stringify(tracks.map(t => t.id))})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Play All
          </button>
          <button class="btn-secondary" onclick="window.historyManager.clearAllPrompt()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Clear History
          </button>
        </div>
      </div>

      <div class="tracks-table-container">
        <div class="tracks-table-header">
          <div class="col-num">#</div>
          <div class="col-title">Title</div>
          <div class="col-album">Album</div>
          <div class="col-format">Format</div>
          <div class="col-dur">Duration</div>
          <div class="col-actions"></div>
        </div>
        <div class="tracks-table-body">
          ${tracks.map((t, idx) => window.libraryManager ? window.libraryManager.renderTrackRow(t, idx + 1, tracks) : '').join("")}
        </div>
      </div>
    `;

    if (window.libraryManager) {
      window.libraryManager.updatePlayingRowIndicators();
    }
  }

  clearAllPrompt() {
    if (confirm("Are you sure you want to clear your listening history?")) {
      window.storageService.clearHistory();
      if (window.app) window.app.showToast("Listening history cleared", "info");
      this.renderHistoryView();
    }
  }
}

window.historyManager = new HistoryManager();
