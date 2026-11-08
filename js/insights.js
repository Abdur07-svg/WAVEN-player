/**
 * WAVEN — MUSIC DNA & LISTENING INSIGHTS
 * Analyzes genuine offline listening patterns, track counts, and playtime.
 * Generates your personalized Music Personality without fabricated data.
 */

class MusicInsightsManager {
  constructor() {
    this._confirmingReset = false;
  }

  init() {
    window.addEventListener("ar7:history_updated", () => {
      if (window.navigation?.currentView === "insights") {
        this.renderInsightsView();
      }
    });
    window.addEventListener("ar7:library_updated", () => {
      if (window.navigation?.currentView === "insights") {
        this.renderInsightsView();
      }
    });
  }

  clearHistoryPrompt(btn) {
    if (this._confirmingReset) {
      if (window.storageService) {
        window.storageService.clearHistory();
        this._confirmingReset = false;
        this.renderInsightsView();
      }
    } else {
      this._confirmingReset = true;
      if (btn) {
        btn.innerHTML = `<span style="color: #f87171; font-weight: 600;">Click to Confirm Reset</span>`;
        btn.style.borderColor = "rgba(239, 68, 68, 0.6)";
        setTimeout(() => {
          this._confirmingReset = false;
          if (btn && btn.isConnected) {
            btn.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>Reset History</span>
            `;
            btn.style.borderColor = "";
          }
        }, 4000);
      }
    }
  }

  renderInsightsView() {
    const container = document.getElementById("insights-view-content");
    if (!container) return;

    if (!window.storageService) {
      container.innerHTML = `<div class="empty-state-box"><p>Storage not available</p></div>`;
      return;
    }

    const stats = window.storageService.getListeningStats();
    const tracks = window.storageService.getAllTracks();
    const favCount = window.storageService.favouritesSet ? window.storageService.favouritesSet.size : 0;

    if (tracks.length === 0) {
      container.innerHTML = `
        <div class="waven-view-header library-header-layout">
          <div class="library-header-text">
            <h1 class="view-main-title">Music DNA &amp; Insights</h1>
            <p class="view-main-subtitle">Your personalized local listening statistics</p>
          </div>
        </div>
        <div class="empty-state-box" style="margin-top: 32px; padding: 48px 24px; text-align: center;">
          <div class="empty-icon-wrap" style="margin: 0 auto 16px; background: rgba(56, 189, 248, 0.15); color: var(--accent-primary); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
          </div>
          <h2 class="empty-title" style="color: #fff; font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">No Music in Library</h2>
          <p class="empty-desc" style="color: #8b92a4; font-size: 0.9rem; margin-bottom: 24px;">Connect your music storage to begin analyzing your Music DNA.</p>
          <button class="btn-primary" onclick="window.app.requestFolderAccess()">Connect Music Storage</button>
        </div>
      `;
      return;
    }

    // Daily histogram max for bar heights
    const dailyStats = stats.dailyStats || stats.dailyActivity || [];
    const maxDayMins = Math.max(1, ...dailyStats.map(d => d.minutes || 0));

    // Daily Bars HTML
    const dailyBarsHtml = dailyStats.map(d => {
      const mins = d.minutes || 0;
      const heightPercent = Math.max(6, Math.round((mins / maxDayMins) * 100));
      return `
        <div class="histogram-col" title="${d.dayName} (${d.dateStr}): ${mins} mins • ${d.plays || 0} plays">
          <div class="histogram-bar-track">
            <div class="histogram-bar-fill" style="height: ${heightPercent}%;"></div>
          </div>
          <span class="histogram-day-label">${d.dayName}</span>
          <span class="histogram-val-label">${mins > 0 ? mins + 'm' : '0m'}</span>
        </div>
      `;
    }).join("");

    // Top Artists HTML
    const topArtistsHtml = stats.topArtists && stats.topArtists.length > 0 ? stats.topArtists.slice(0, 6).map((a, i) => `
      <div class="insights-rank-row" onclick="window.navigation.navigateTo('artist', encodeURIComponent('${(a.name || '').replace(/'/g, "\\'")}'))">
        <span class="insights-rank-num">#${i + 1}</span>
        <div class="insights-rank-avatar">${(a.name || 'A').charAt(0).toUpperCase()}</div>
        <div class="insights-rank-info">
          <span class="insights-rank-name">${a.name}</span>
          <span class="insights-rank-sub">${a.count} song${a.count === 1 ? '' : 's'} in library • ${a.plays} play${a.plays === 1 ? '' : 's'}</span>
        </div>
      </div>
    `).join("") : `<div class="insights-empty-note">Play songs to calculate your top artists</div>`;

    // Most Played Tracks HTML
    const mostPlayedHtml = stats.mostPlayed && stats.mostPlayed.length > 0 ? stats.mostPlayed.slice(0, 5).map((t, i) => {
      const art = window.getTrackArtwork ? window.getTrackArtwork(t) : (t.artwork || "assets/covers/default_cover.svg");
      const durStr = window.libraryManager ? window.libraryManager.formatDuration(t.duration || 0) : "0:00";
      return `
        <div class="insights-track-row" onclick="window.player.playTrack(window.storageService.getTrackById('${t.id}'), window.storageService.getAllTracks())">
          <span class="insights-rank-num">#${i + 1}</span>
          <img src="${art}" class="insights-track-thumb" alt="${t.title}" data-title="${t.title}" data-artist="${t.artist}" onerror="window.handleTrackImgError(this)" />
          <div class="insights-track-meta">
            <span class="insights-track-title">${t.title || 'Unknown Title'}</span>
            <span class="insights-track-artist">${t.artist || 'Local Audio'}</span>
          </div>
          <div class="insights-track-stats">
            <span class="insights-play-count">${t.playCount || 0} plays</span>
            <span class="insights-track-dur">${durStr}</span>
          </div>
        </div>
      `;
    }).join("") : `<div class="insights-empty-note">Listen for at least 15 seconds to log verified plays</div>`;

    // Top Genres Pill Grid
    const topGenresHtml = stats.topGenres && stats.topGenres.length > 0 ? stats.topGenres.map(g => `
      <div class="dna-genre-chip">
        <span class="genre-chip-name">${g.name}</span>
        <span class="genre-chip-weight">${g.weight} pts</span>
      </div>
    `).join("") : `<div class="insights-empty-note">Add genre tags in Library Tools to reveal your genre DNA</div>`;

    const personality = stats.personality || stats.archetype || {
      title: "Eclectic Sound Alchemist",
      desc: "Your tastes fluidly span multiple genres and sonic textures, curating a vibrant and open-minded local library."
    };

    container.innerHTML = `
      <div class="waven-view-header insights-header-layout">
        <div class="insights-header-text">
          <h1 class="view-main-title insights-main-title">Music DNA &amp; Insights</h1>
          <p class="view-main-subtitle insights-main-subtitle">100% genuine offline listening patterns derived from your local library</p>
        </div>
        <div class="insights-header-actions">
          <button class="btn-secondary library-action-btn insights-action-btn" id="dna-reset-history-btn" onclick="window.musicInsights.clearHistoryPrompt(this)" aria-label="Reset History">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Reset History</span>
          </button>
        </div>
      </div>

      <div class="insights-container">
        <!-- 1. Music Personality Hero Card -->
        <div class="dna-hero-card">
          <div class="dna-hero-badge">
            <span class="dna-sparkle-dot"></span>
            <span>YOUR MUSIC PERSONALITY</span>
          </div>
          <h2 class="dna-archetype-title">${personality.title}</h2>
          <p class="dna-archetype-desc">${personality.desc}</p>
          
          <div class="dna-stats-grid">
            <div class="dna-stat-box">
              <span class="dna-stat-val">${stats.formattedListeningTime || (stats.totalHours ? `${stats.totalHours}h ${stats.totalMinutes}m` : `${stats.totalMinutes || 0}m`)}</span>
              <span class="dna-stat-lbl">Total Time Listened</span>
            </div>
            <div class="dna-stat-box">
              <span class="dna-stat-val">${stats.totalPlays}</span>
              <span class="dna-stat-lbl">Verified Plays</span>
            </div>
            <div class="dna-stat-box">
              <span class="dna-stat-val">${stats.totalTracks}</span>
              <span class="dna-stat-lbl">Library Songs</span>
            </div>
            <div class="dna-stat-box">
              <span class="dna-stat-val">${favCount}</span>
              <span class="dna-stat-lbl">Favourites</span>
            </div>
          </div>
        </div>

        <!-- 2. Analytics 2-Column Split Grid -->
        <div class="insights-split-grid">
          <!-- A. Listening Activity (Past 7 Days Histogram) -->
          <div class="insights-card">
            <h3 class="insights-card-title">Weekly Listening Cadence</h3>
            <p class="insights-card-desc">Daily listening minutes over the past 7 days</p>
            <div class="histogram-bars-row">
              ${dailyBarsHtml}
            </div>
          </div>

          <!-- B. Top Genres DNA -->
          <div class="insights-card">
            <h3 class="insights-card-title">Top Sonic Textures</h3>
            <p class="insights-card-desc">Leading genres across your local library metadata</p>
            <div class="dna-genre-pills-wrap">
              ${topGenresHtml}
            </div>
          </div>

          <!-- C. Most Played Songs -->
          <div class="insights-card">
            <h3 class="insights-card-title">Most Played Songs</h3>
            <p class="insights-card-desc">Tracks with verified plays exceeding the 15-second minimum threshold</p>
            <div class="insights-tracks-list">
              ${mostPlayedHtml}
            </div>
          </div>

          <!-- D. Top Artists -->
          <div class="insights-card">
            <h3 class="insights-card-title">Top Artists</h3>
            <p class="insights-card-desc">Most frequent creators in your local sessions</p>
            <div class="insights-artists-list">
              ${topArtistsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

window.musicInsights = new MusicInsightsManager();
