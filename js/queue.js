/**
 * WAVEN — SMART QUEUE MANAGER
 * High-performance queue with Smart Shuffle, "Continue the Vibe" local suggestions,
 * drag-free reordering, and compact player integration.
 */

class QueueManager {
  constructor() {
    this.queue = [];
    this.currentIndex = -1;
    this.shuffleHistory = [];
    this.isSmartShuffle = false;
    this.storageKey = "waven_playback_queue_v2";

    // Load saved settings
    if (window.storageService) {
      const settings = window.storageService.getSettings();
      this.isSmartShuffle = Boolean(settings.isSmartShuffle);
    }
  }

  init() {
    this.loadSavedQueue();
  }

  setQueue(tracks, currentTrack = null) {
    if (!Array.isArray(tracks)) return;
    this.queue = [...tracks];
    if (currentTrack) {
      this.currentIndex = this.queue.findIndex(t => t.id === currentTrack.id);
      if (this.currentIndex === -1) {
        this.queue.unshift(currentTrack);
        this.currentIndex = 0;
      }
    } else {
      this.currentIndex = this.queue.length > 0 ? 0 : -1;
    }
    this.shuffleHistory = this.currentIndex >= 0 ? [this.currentIndex] : [];
    this.saveQueueState();
    this.render();
  }

  addToQueue(track) {
    if (!track) return;
    this.queue.push(track);
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
    }
    this.saveQueueState();
    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast(`Added "${track.title}" to Queue`, "success");
    }
  }

  playNext(track) {
    if (!track) return;
    if (this.currentIndex === -1 || this.queue.length === 0) {
      this.queue.push(track);
      this.currentIndex = 0;
    } else {
      this.queue.splice(this.currentIndex + 1, 0, track);
    }
    this.saveQueueState();
    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast(`Playing "${track.title}" next`, "success");
    }
  }

  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex && this.currentIndex >= this.queue.length) {
      this.currentIndex = this.queue.length - 1;
    }
    this.saveQueueState();
    this.render();
  }

  clearQueue() {
    const current = this.getCurrentTrack();
    this.queue = current ? [current] : [];
    this.currentIndex = current ? 0 : -1;
    this.shuffleHistory = this.currentIndex >= 0 ? [this.currentIndex] : [];
    this.saveQueueState();
    this.render();
    if (window.app && window.app.showToast) {
      window.app.showToast("Queue cleared", "info");
    }
  }

  hasTrack(trackId) {
    return this.queue.some(t => t.id === trackId);
  }

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  getNextTrack(isShuffle = false) {
    if (this.queue.length === 0) return null;

    // 1. SMART SHUFFLE
    if (isShuffle && this.isSmartShuffle && this.queue.length > 1) {
      return this._getSmartShuffleTrack();
    }

    // 2. NORMAL SHUFFLE
    if (isShuffle && this.queue.length > 1) {
      const unplayedIndices = [];
      for (let i = 0; i < this.queue.length; i++) {
        if (i !== this.currentIndex && !this.shuffleHistory.includes(i)) {
          unplayedIndices.push(i);
        }
      }

      let nextIndex;
      if (unplayedIndices.length === 0) {
        this.shuffleHistory = [this.currentIndex];
        const resetIndices = [];
        for (let i = 0; i < this.queue.length; i++) {
          if (i !== this.currentIndex) resetIndices.push(i);
        }
        nextIndex = resetIndices[Math.floor(Math.random() * resetIndices.length)];
      } else {
        nextIndex = unplayedIndices[Math.floor(Math.random() * unplayedIndices.length)];
      }

      this.shuffleHistory.push(nextIndex);
      this.currentIndex = nextIndex;
      this.saveQueueState();
      this.render();
      return this.queue[this.currentIndex];
    }

    // 3. SEQUENTIAL NEXT
    if (this.currentIndex + 1 < this.queue.length) {
      this.currentIndex++;
      this.saveQueueState();
      this.render();
      return this.queue[this.currentIndex];
    }

    return null;
  }

  _getSmartShuffleTrack() {
    const current = this.getCurrentTrack();
    const candidateIndices = [];

    for (let i = 0; i < this.queue.length; i++) {
      if (i !== this.currentIndex && !this.shuffleHistory.includes(i)) {
        candidateIndices.push(i);
      }
    }

    // If all played, reset history except current
    const pool = candidateIndices.length > 0 ? candidateIndices : this.queue.map((_, i) => i).filter(i => i !== this.currentIndex);
    if (candidateIndices.length === 0) {
      this.shuffleHistory = [this.currentIndex];
    }

    // Score candidates by vibe compatibility
    const scored = pool.map(idx => {
      const t = this.queue[idx];
      let score = 5;

      if (current) {
        // Genre similarity (+4)
        if (current.genre && t.genre && current.genre.toLowerCase() === t.genre.toLowerCase()) {
          score += 4;
        }
        // Album continuity (+3)
        if (current.album && t.album && current.album === t.album) {
          score += 3;
        }
        // Avoid back-to-back same artist unless queue is very small (-2)
        if (current.artist && t.artist && current.artist === t.artist && pool.length > 3) {
          score -= 2;
        }
      }

      // Least recently played priority (+2)
      if (!t.lastPlayed) score += 2;

      // Small non-deterministic jitter for freshness
      score += Math.random() * 2;

      return { idx, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const chosenIndex = scored[0].idx;

    this.shuffleHistory.push(chosenIndex);
    this.currentIndex = chosenIndex;
    this.saveQueueState();
    this.render();
    return this.queue[this.currentIndex];
  }

  getPreviousTrack() {
    if (this.queue.length === 0) return null;
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.saveQueueState();
      this.render();
      return this.queue[this.currentIndex];
    }
    return this.queue[0];
  }

  jumpToIndex(index) {
    if (index >= 0 && index < this.queue.length) {
      this.currentIndex = index;
      if (window.player) {
        window.player.playTrack(this.queue[index]);
      }
      this.saveQueueState();
      this.render();
    }
  }

  moveTrack(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.queue.length || toIndex < 0 || toIndex >= this.queue.length) return;
    const item = this.queue.splice(fromIndex, 1)[0];
    this.queue.splice(toIndex, 0, item);
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }
    this.saveQueueState();
    this.render();
  }

  /**
   * "Continue the Vibe": Recommends similar songs from local library
   */
  continueTheVibe() {
    const current = this.getCurrentTrack();
    if (!current || !window.storageService) {
      if (window.app) window.app.showToast("Play a song first to continue its vibe", "info");
      return;
    }

    const allTracks = window.storageService.getAllTracks();
    const queuedIds = new Set(this.queue.map(t => t.id));

    // Find candidates not currently in queue
    const candidates = allTracks.filter(t => !queuedIds.has(t.id));

    if (candidates.length === 0) {
      if (window.app) window.app.showToast("All your local songs are already in the queue!", "info");
      return;
    }

    // Score by similarity to current track
    const scored = candidates.map(t => {
      let score = 0;
      if (current.artist && t.artist && current.artist.toLowerCase() === t.artist.toLowerCase()) score += 5;
      if (current.genre && t.genre && current.genre.toLowerCase() === t.genre.toLowerCase()) score += 4;
      if (current.album && t.album && current.album.toLowerCase() === t.album.toLowerCase()) score += 3;
      if (!t.lastPlayed) score += 2;
      score += Math.random() * 2;
      return { track: t, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const added = scored.slice(0, 5).map(s => s.track);

    this.queue.push(...added);
    this.saveQueueState();
    this.render();

    if (window.app) {
      window.app.showToast(`✨ Added ${added.length} vibe-matched tracks to queue`, "success");
    }
  }

  saveQueueState() {
    try {
      const data = {
        ids: this.queue.map(t => t.id),
        currentIndex: this.currentIndex
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn("[QueueManager] Failed to persist queue:", e);
    }
  }

  loadSavedQueue() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw || !window.storageService) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.ids) && data.ids.length > 0) {
        const restored = data.ids.map(id => window.storageService.getTrackById(id)).filter(Boolean);
        if (restored.length > 0) {
          this.queue = restored;
          this.currentIndex = (data.currentIndex >= 0 && data.currentIndex < restored.length) ? data.currentIndex : 0;
          this.render();
        }
      }
    } catch (e) {
      console.warn("[QueueManager] Failed to restore queue:", e);
    }
  }

  toggleSmartShuffle() {
    this.isSmartShuffle = !this.isSmartShuffle;
    if (window.player) {
      window.player.state.isSmartShuffle = this.isSmartShuffle;
      if (this.isSmartShuffle) window.player.state.shuffle = true;
      window.player._updateShuffleUI();
    }
    if (window.storageService) {
      window.storageService.saveSettings({ isSmartShuffle: this.isSmartShuffle });
    }
    this.render();
    if (window.app) {
      window.app.showToast(`Smart Shuffle ${this.isSmartShuffle ? 'ACTIVATED ✨' : 'DEACTIVATED'}`, "info");
    }
  }

  toggleExpandableQueue() {
    const overlay = document.getElementById("player-card-queue-overlay");
    if (!overlay) return;
    overlay.classList.toggle("active");
    this.render();
  }

  render() {
    const currentTrack = this.getCurrentTrack();
    const upNextTracks = this.queue.slice(this.currentIndex + 1);

    const formatRow = (track, actualIndex, isPlaying = false) => {
      const art = window.getTrackArtwork ? window.getTrackArtwork(track) : (track.artwork || "assets/covers/default_cover.svg");
      const dur = window.player ? window.player.formatTime(track.duration) : "0:00";
      return `
        <div class="queue-track-item ${isPlaying ? 'active' : ''}" onclick="window.queueManager.jumpToIndex(${actualIndex})">
          <img class="queue-item-art" src="${art}" alt="${track.title}" data-title="${track.title || ''}" data-artist="${track.artist || ''}" onerror="window.handleTrackImgError(this)" />
          <div class="queue-item-meta">
            <span class="queue-item-title">${track.title || 'Unknown Title'}</span>
            <span class="queue-item-artist">${track.artist || 'Local Audio'}</span>
          </div>
          <span class="queue-item-dur">${dur}</span>
          ${!isPlaying ? `
            <div class="queue-item-actions" onclick="event.stopPropagation()">
              <button class="queue-row-btn" title="Move Up" onclick="window.queueManager.moveTrack(${actualIndex}, ${Math.max(this.currentIndex + 1, actualIndex - 1)})">▲</button>
              <button class="queue-row-btn" title="Move Down" onclick="window.queueManager.moveTrack(${actualIndex}, ${Math.min(this.queue.length - 1, actualIndex + 1)})">▼</button>
              <button class="queue-remove-btn" title="Remove" onclick="window.queueManager.removeFromQueue(${actualIndex})">✕</button>
            </div>
          ` : `
            <span class="queue-now-badge">Playing</span>
          `}
        </div>
      `;
    };

    // 1. Render in Desktop Right Player Card Expandable Queue Overlay
    const overlayContainer = document.getElementById("player-card-queue-overlay");
    if (overlayContainer) {
      overlayContainer.innerHTML = `
        <div class="player-queue-header">
          <div class="player-queue-title-wrap">
            <h4 class="player-queue-title">Playback Queue</h4>
            <span class="player-queue-count">${this.queue.length} track${this.queue.length === 1 ? '' : 's'}</span>
          </div>
          <div class="player-queue-top-actions">
            <button class="queue-smart-toggle-btn ${this.isSmartShuffle ? 'active' : ''}" title="Toggle Smart Shuffle (Vibe Weighted)" onclick="window.queueManager.toggleSmartShuffle()">
              ✨ Smart
            </button>
            <button class="glass-round-btn-sm" title="Close Queue" onclick="window.queueManager.toggleExpandableQueue()">✕</button>
          </div>
        </div>

        <div class="player-queue-actions-bar">
          <button class="queue-vibe-btn" onclick="window.queueManager.continueTheVibe()">
            <span>✨ Continue the Vibe</span>
          </button>
          ${upNextTracks.length > 0 ? `
            <button class="queue-clear-sm-btn" onclick="window.queueManager.clearQueue()">Clear Up Next</button>
          ` : ''}
        </div>

        <div class="player-queue-scrollable">
          <div class="queue-section-label">NOW PLAYING</div>
          ${currentTrack ? formatRow(currentTrack, this.currentIndex, true) : '<div class="queue-empty-note">No track loaded</div>'}

          <div class="queue-section-label" style="margin-top: 14px;">UP NEXT (${upNextTracks.length})</div>
          ${upNextTracks.length > 0
            ? upNextTracks.map((t, idx) => formatRow(t, this.currentIndex + 1 + idx, false)).join("")
            : '<div class="queue-empty-note">Queue complete. Click "Continue the Vibe" to add matching songs!</div>'
          }
        </div>
      `;
    }

    // 2. Render in Slide-out Queue Drawer (Mobile / Fallback)
    const nowPlayingDrawer = document.getElementById("queue-now-playing-container");
    const upNextDrawer = document.getElementById("queue-up-next-container");

    if (nowPlayingDrawer) {
      nowPlayingDrawer.innerHTML = currentTrack ? formatRow(currentTrack, this.currentIndex, true) : `<div class="queue-empty-note">No track currently playing</div>`;
    }

    if (upNextDrawer) {
      upNextDrawer.innerHTML = upNextTracks.length > 0
        ? upNextTracks.map((t, idx) => formatRow(t, this.currentIndex + 1 + idx, false)).join("")
        : `<div class="queue-empty-note">No upcoming tracks in queue</div>`;
    }
  }
}

window.queueManager = new QueueManager();
