/**
 * WAVEN — SYNCHRONIZED LYRICS ENGINE
 * Supports real-time LRC timestamp parsing ([mm:ss.xx]), plain-text lyrics,
 * synchronized auto-scrolling, in-app lyric editing, and local .lrc file importing.
 */

class LyricsManager {
  constructor() {
    this.currentTrackId = null;
    this.lyricsData = []; // Array of { time: number (seconds), text: string }
    this.isLrc = false;
    this.activeLineIndex = -1;
    this.isUserScrolling = false;
    this.userScrollTimeout = null;
    this.isEditorOpen = false;

    this.init();
  }

  init() {
    window.addEventListener("ar7:player_track_loaded", (e) => {
      const track = e.detail;
      this.loadTrackLyrics(track);
    });

    window.addEventListener("ar7:player_time_updated", (e) => {
      this.syncTime(e.detail.currentTime);
    });
  }

  /**
   * Parse LRC text or plain text into structured array
   */
  parseLyrics(rawText) {
    if (!rawText || !rawText.trim()) {
      return { lines: [], isLrc: false };
    }

    const lines = rawText.split(/\r?\n/);
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    const parsed = [];
    let hasTimecodes = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extract all time tags on this line
      const matches = [...trimmed.matchAll(timeRegex)];
      if (matches.length > 0) {
        hasTimecodes = true;
        const text = trimmed.replace(timeRegex, "").trim();
        for (const match of matches) {
          const mins = parseInt(match[1], 10);
          const secs = parseInt(match[2], 10);
          const msStr = match[3] || "0";
          const ms = parseFloat(`0.${msStr}`);
          const timeSec = mins * 60 + secs + ms;
          parsed.push({ time: timeSec, text: text || "♪" });
        }
      } else {
        // Plain text line
        parsed.push({ time: null, text: trimmed });
      }
    }

    if (hasTimecodes) {
      // Sort chronologically by time
      parsed.sort((a, b) => (a.time || 0) - (b.time || 0));
      return { lines: parsed, isLrc: true };
    }

    return { lines: parsed, isLrc: false };
  }

  loadTrackLyrics(track) {
    if (!track) {
      this.currentTrackId = null;
      this.lyricsData = [];
      this.isLrc = false;
      this.activeLineIndex = -1;
      this.render();
      return;
    }

    this.currentTrackId = track.id;
    this.activeLineIndex = -1;

    const rawLyrics = track.lyrics || "";
    const parsed = this.parseLyrics(rawLyrics);
    this.lyricsData = parsed.lines;
    this.isLrc = parsed.isLrc;

    this.render();
  }

  /**
   * Synchronize active line to current playback time (seconds)
   */
  syncTime(currentTime) {
    if (!this.isLrc || this.lyricsData.length === 0) return;

    let newIndex = -1;
    for (let i = 0; i < this.lyricsData.length; i++) {
      if (currentTime >= this.lyricsData[i].time) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== this.activeLineIndex) {
      this.activeLineIndex = newIndex;
      this.updateActiveLineDOM();
    }
  }

  updateActiveLineDOM() {
    const containers = [
      document.getElementById("player-card-lyrics-scroll"),
      document.getElementById("immersive-lyrics-scroll")
    ];

    containers.forEach(container => {
      if (!container) return;

      const lines = container.querySelectorAll(".lyric-line");
      lines.forEach((el, idx) => {
        if (idx === this.activeLineIndex) {
          el.classList.add("active");
          if (!this.isUserScrolling) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } else {
          el.classList.remove("active");
        }
      });
    });
  }

  togglePlayerLyricsOverlay() {
    const overlay = document.getElementById("player-card-lyrics-overlay");
    const btn = document.getElementById("player-card-lyrics-btn");
    if (!overlay) return;

    const isActive = overlay.classList.contains("active");
    if (isActive) {
      overlay.classList.remove("active");
      if (btn) btn.classList.remove("active", "lyrics-active");
    } else {
      // Close queue overlay if open
      const queueOverlay = document.getElementById("player-card-queue-overlay");
      if (queueOverlay) queueOverlay.classList.remove("active");
      const queueBtn = document.getElementById("player-card-queue-btn");
      if (queueBtn) queueBtn.classList.remove("active");

      overlay.classList.add("active");
      if (btn) btn.classList.add("active", "lyrics-active");
      const currentTrack = window.player?.state?.currentTrack;
      this.loadTrackLyrics(currentTrack);
      setTimeout(() => this.updateActiveLineDOM(), 100);
    }
  }

  jumpToTime(seconds) {
    if (seconds !== null && window.player) {
      window.player.seekTo(seconds);
    }
  }

  openEditor(trackId = null) {
    const targetId = trackId || this.currentTrackId || window.player?.state?.currentTrack?.id;
    const track = window.storageService ? (window.storageService.getTrackById(targetId) || window.player?.state?.currentTrack) : window.player?.state?.currentTrack;
    if (!track) {
      if (window.app) window.app.showToast("No track selected to edit lyrics.", "info");
      return;
    }
    this.currentTrackId = track.id;

    let modal = document.getElementById("lyrics-editor-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "lyrics-editor-modal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }
    modal.style.zIndex = "10050";

    modal.innerHTML = `
      <div class="modal-card lyric-editor-modal-card" style="max-width: 540px; width: 92%; box-sizing: border-box; overflow: hidden;">
        <div class="modal-header lyric-editor-header" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; width: 100%; box-sizing: border-box; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; overflow: hidden;">
            <span style="font-size: 1.25rem; flex-shrink: 0;">🎤</span>
            <div style="min-width: 0; flex: 1; overflow: hidden;">
              <h3 class="modal-title" style="margin: 0; font-size: 1.1rem; line-height: 1.25;">Lyric Editor</h3>
              <p class="lyric-editor-subtitle" style="font-size: 0.76rem; color: var(--text-muted); margin: 3px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;" title="${(track.title || '').replace(/"/g, '&quot;')} • ${(track.artist || 'Local Audio').replace(/"/g, '&quot;')}">${track.title} • ${track.artist || 'Local Audio'}</p>
            </div>
          </div>
          <button class="modal-close-btn" style="flex-shrink: 0;" aria-label="Close Lyric Editor" onclick="window.lyricsManager.closeEditor()">✕</button>
        </div>
        <div style="padding: 0; box-sizing: border-box;">
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">
            Paste synchronized <code>[mm:ss.xx]</code> LRC lyrics or plain text. Playback automatically follows the timing tags!
          </p>
          <textarea id="lyric-editor-textarea" style="width: 100%; height: 260px; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: #fff; padding: 12px; font-family: monospace; font-size: 0.82rem; resize: vertical; box-sizing: border-box;" placeholder="[00:15.50]First line of lyrics\n[00:19.80]Second line of lyrics...">${track.lyrics || ""}</textarea>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px;">
            <label class="btn-secondary" style="font-size: 0.8rem; cursor: pointer; padding: 8px 14px; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Import .LRC File
              <input type="file" accept=".lrc,.txt" style="display: none;" onchange="window.lyricsManager.handleLrcFileImport(event)" />
            </label>
            <div style="display: flex; gap: 10px; margin-left: auto;">
              <button class="btn-secondary" style="padding: 8px 16px;" onclick="window.lyricsManager.closeEditor()">Cancel</button>
              <button class="btn-primary" style="padding: 8px 16px;" onclick="window.lyricsManager.saveLyricsFromEditor()">Save Lyrics</button>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.classList.add("active");
    this.isEditorOpen = true;
  }

  closeEditor() {
    const modal = document.getElementById("lyrics-editor-modal");
    if (modal) modal.classList.remove("active");
    this.isEditorOpen = false;
  }

  async handleLrcFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const textarea = document.getElementById("lyric-editor-textarea");
      if (textarea) textarea.value = text;
      if (window.app) window.app.showToast(`Imported "${file.name}"`, "info");
    } catch (err) {
      if (window.app) window.app.showToast("Failed to read lyric file: " + err.message, "error");
    }
  }

  async saveLyricsFromEditor() {
    const textarea = document.getElementById("lyric-editor-textarea");
    if (!textarea || !this.currentTrackId) return;

    const newLyrics = textarea.value.trim();
    if (window.storageService) {
      await window.storageService.updateTrackMetadata(this.currentTrackId, { lyrics: newLyrics });
      const currentTrack = window.player?.state?.currentTrack;
      if (currentTrack && currentTrack.id === this.currentTrackId) {
        currentTrack.lyrics = newLyrics;
      }
      this.loadTrackLyrics(currentTrack);
      this.closeEditor();
      if (window.app) window.app.showToast("Lyrics updated successfully!", "success");
    }
  }

  render() {
    const overlay = document.getElementById("player-card-lyrics-overlay");
    const immersiveContainer = document.getElementById("immersive-lyrics-view");

    const track = window.player?.state?.currentTrack;
    let contentHtml = "";

    if (!track) {
      contentHtml = `
        <div class="lyrics-empty-state">
          <div class="lyrics-empty-icon">🎵</div>
          <h4 class="lyrics-empty-title">No Track Playing</h4>
          <p class="lyrics-empty-desc">Play a song to view or edit synchronized lyrics.</p>
        </div>
      `;
    } else if (this.lyricsData.length === 0) {
      contentHtml = `
        <div class="lyrics-empty-state">
          <div class="lyrics-empty-icon">🎤</div>
          <h4 class="lyrics-empty-title">No Lyrics Available</h4>
          <p class="lyrics-empty-desc">Lyrics have not been added for "${track.title}" yet.</p>
          <button class="btn-primary" style="margin-top: 14px;" onclick="window.lyricsManager.openEditor()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            Add / Import Lyrics
          </button>
        </div>
      `;
    } else {
      const linesHtml = this.lyricsData.map((item, idx) => {
        const hasTime = item.time !== null;
        return `
          <div class="lyric-line ${idx === this.activeLineIndex ? 'active' : ''} ${hasTime ? 'clickable' : ''}" 
               data-index="${idx}" 
               onclick="${hasTime ? `window.lyricsManager.jumpToTime(${item.time})` : ''}">
            ${item.text}
          </div>
        `;
      }).join("");

      contentHtml = `
        <div class="lyrics-lines-container">
          ${linesHtml}
        </div>
      `;
    }

    // Render inside Desktop Player Card
    if (overlay) {
      overlay.innerHTML = `
        <div class="player-lyrics-header">
          <div class="player-lyrics-title-wrap">
            <h4 class="player-lyrics-title">Lyrics</h4>
            <span class="player-lyrics-type-tag">${this.isLrc ? 'SYNCED LRC' : (this.lyricsData.length > 0 ? 'PLAIN TEXT' : 'OFFLINE')}</span>
          </div>
          <div class="player-lyrics-top-actions">
            <button class="glass-round-btn-sm" title="Edit Lyrics" onclick="window.lyricsManager.openEditor()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="glass-round-btn-sm" title="Close Lyrics" onclick="window.lyricsManager.togglePlayerLyricsOverlay()">✕</button>
          </div>
        </div>
        <div class="player-lyrics-scroll-body" id="player-card-lyrics-scroll" onscroll="window.lyricsManager.handleUserScroll()">
          ${contentHtml}
        </div>
      `;
    }

    // Render inside Immersive Overlay if active
    if (immersiveContainer) {
      immersiveContainer.innerHTML = `
        <div class="immersive-lyrics-scroll-body" id="immersive-lyrics-scroll" onscroll="window.lyricsManager.handleUserScroll()">
          ${contentHtml}
        </div>
      `;
    }
  }

  handleUserScroll() {
    this.isUserScrolling = true;
    clearTimeout(this.userScrollTimeout);
    this.userScrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, 2500);
  }
}

window.lyricsManager = new LyricsManager();

