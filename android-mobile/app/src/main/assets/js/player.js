/**
 * AR7 MUSIC — REAL AUDIO PLAYBACK ENGINE & RESOLVER
 * Manages HTMLAudioElement playback, object URL lifecycles, scrub seeking,
 * repeat modes (off/all/one), shuffle, volume/mute, and future streaming provider hooks.
 */

class AudioSourceResolver {
  /**
   * Resolves a playable URL for any provider-agnostic track model.
   * Keeps local audio playback strictly local, while providing an architectural
   * extension point for future authorized streaming providers.
   * @param {Object} track
   * @returns {Promise<{ url: string, isObjectUrl: boolean }>}
   */
  static async resolveSource(track) {
    if (!track) throw new Error("No track provided");

    // 0. Android Native MediaStore Stream
    if (track.sourceType === "android-media" || (track.streamUrl && track.streamUrl.startsWith("https://waven.local/"))) {
      return { url: track.streamUrl, isObjectUrl: false };
    }

    // 1. Local file playback
    if (track.sourceType === "local-file" || track.file) {
      if (track.file instanceof Blob || track.file instanceof File) {
        const objectUrl = URL.createObjectURL(track.file);
        return { url: objectUrl, isObjectUrl: true };
      }

      // Check if we can locate the track in storage
      if (window.storageService) {
        const stored = window.storageService.getTrackById(track.id);
        if (stored && (stored.file instanceof Blob || stored.file instanceof File)) {
          const objectUrl = URL.createObjectURL(stored.file);
          return { url: objectUrl, isObjectUrl: true };
        }
      }

      throw new Error("Local audio file is no longer available in memory. Please relink the file.");
    }

    // 2. Demo preview tracks (or when track has no local file attached yet)
    if (track.isDemo || (track.id && (track.id.startsWith("demo_") || track.id.startsWith("feat_")))) {
      return { url: "assets/audio/demo_preview.wav", isObjectUrl: false };
    }

    // 3. Future Authorized Online Streaming Provider Extension Point
    if (track.sourceType === "stream" || track.streamUrl || track.previewUrl) {
      const streamUrl = track.streamUrl || track.previewUrl;
      return { url: streamUrl, isObjectUrl: false };
    }

    // Fallback to demo audio preview if no file attached
    return { url: "assets/audio/demo_preview.wav", isObjectUrl: false };
  }
}

class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";

    const savedSettings = window.storageService ? window.storageService.getSettings() : {};
    const initialVol = (typeof savedSettings.volume === "number" && !isNaN(savedSettings.volume) && savedSettings.volume > 0) ? savedSettings.volume : 0.85;

    this.state = {
      currentTrack: null,
      isPlaying: false,
      volume: initialVol,
      isMuted: Boolean(savedSettings.isMuted),
      repeatMode: savedSettings.repeatMode || "off", // 'off' | 'all' | 'one'
      shuffle: Boolean(savedSettings.shuffle),
      isSmartShuffle: Boolean(savedSettings.isSmartShuffle),
      currentTime: 0,
      duration: 0,
      buffered: 0,
      isLoading: false,
      isSeeking: false
    };

    // Robust seek & scrub state machine
    this.isScrubbing = false;
    this.wasPlayingBeforeScrub = false;
    this.pendingSeekTarget = null;

    // Race-condition prevention generation token
    this._playRequestId = 0;

    // Rate-limiting and deduping native notification bridge
    this._lastNotificationSyncTime = 0;
    this._lastSyncedTrackId = null;
    this._lastSyncedPlaying = null;
    this._actionThrottle = 0;

    this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
    this.audio.muted = this.state.isMuted;
    this.crossfadeSecs = Number(savedSettings.crossfade) || 0;
    this.normalizeVolume = Boolean(savedSettings.normalize);
    if (this.normalizeVolume && this.audio.volume > 0.82) {
      this.audio.volume = 0.82;
    }
    this.currentObjectUrl = null;
    this.listeners = new Map();

    this._bindAudioEvents();
    window.addEventListener("ar7:liked_updated", () => this.updateHeartUI());

    if (window.AndroidBridge && typeof window.AndroidBridge.notifyPlayerReady === "function") {
      try { window.AndroidBridge.notifyPlayerReady(); } catch (e) {}
    }
  }

  _bindAudioEvents() {
    this.audio.addEventListener("loadstart", () => {
      this.state.isLoading = true;
      this._emit("loading", { isLoading: true });
    });

    this.audio.addEventListener("loadedmetadata", () => {
      if (this.audio.duration && isFinite(this.audio.duration) && this.audio.duration > 0) {
        this.state.duration = this.audio.duration;
        this._updateProgressUI();
        if (window.mediaSessionManager) {
          window.mediaSessionManager.updatePositionState(this.state.currentTime, this.state.duration);
        }
      }
    });

    this.audio.addEventListener("canplay", () => {
      this.state.isLoading = false;
      this._emit("loading", { isLoading: false });
      // If state is supposed to be playing and audio paused (and not scrubbing), ensure it resumes
      if ((this.state.isPlaying || this.wasPlayingBeforeScrub) && this.audio.paused && !this.isScrubbing) {
        this.audio.play().catch(e => console.warn("[AudioPlayer] canplay resume error:", e));
      }
    });

    this.audio.addEventListener("seeking", () => {
      this.state.isSeeking = true;
      this._emit("seeking", { currentTime: this.audio.currentTime });
    });

    this.audio.addEventListener("seeked", () => {
      // If rapid consecutive seeks were requested while the browser was decoding the previous seek
      if (this.pendingSeekTarget !== null) {
        const nextTarget = this.pendingSeekTarget;
        this.pendingSeekTarget = null;
        try {
          this.audio.currentTime = nextTarget;
        } catch (e) {
          console.warn("[AudioPlayer] pending seek error:", e);
        }
        return;
      }

      this.state.isSeeking = false;
      this.state.currentTime = this.audio.currentTime || 0;
      this._updateProgressUI();
      this._emit("seeked", { currentTime: this.state.currentTime });

      if (window.mediaSessionManager) {
        window.mediaSessionManager.updatePositionState(this.state.currentTime, this.state.duration);
      }

      // If playback was active before seeking, resume without pause
      if (this.wasPlayingBeforeScrub || this.state.isPlaying) {
        this.wasPlayingBeforeScrub = false;
        if (this.audio.paused) {
          this.audio.play()
            .then(() => {
              this.state.isPlaying = true;
              this._updateUIState();
              this._syncNativeNotification(true);
            })
            .catch(e => console.warn("[AudioPlayer] resume after seeked error:", e));
        }
      }
    });

    this.audio.addEventListener("waiting", () => {
      this.state.isLoading = true;
      this._emit("loading", { isLoading: true });
    });

    this.audio.addEventListener("stalled", () => {
      this.state.isLoading = true;
      this._emit("loading", { isLoading: true });
    });

    this.audio.addEventListener("playing", () => {
      this.state.isPlaying = true;
      this.state.isLoading = false;
      this._emit("state_changed", this.state);
      this._updateUIState();
      this._syncNativeNotification(true);
      if (window.mediaSessionManager) {
        window.mediaSessionManager.updatePlaybackState(true);
      }
    });

    this.audio.addEventListener("pause", () => {
      // CRITICAL AUDIO ENGINE GUARD:
      // When audio.currentTime is updated, Chromium and WebView media pipelines fire a transient
      // 'pause' or 'waiting' event while re-aligning decoders. If seeking, scrubbing, or loading, DO NOT treat
      // this as an intentional user pause!
      if (this.audio.seeking || this.state.isSeeking || this.isScrubbing || this.state.isLoading || this.wasPlayingBeforeScrub) {
        return;
      }

      this.state.isPlaying = false;
      this._emit("state_changed", this.state);
      this._updateUIState();
      this._syncNativeNotification(false);
      if (window.mediaSessionManager) {
        window.mediaSessionManager.updatePlaybackState(false);
      }
    });

    this.audio.addEventListener("timeupdate", () => {
      if (this.state.isSeeking || this.isScrubbing) return; // Don't jump while user is dragging seek thumb
      this.state.currentTime = this.audio.currentTime || 0;
      this.state.duration = (this.audio.duration && isFinite(this.audio.duration)) ? this.audio.duration : (this.state.currentTrack?.duration || 0);
      this._emit("time_updated", {
        currentTime: this.state.currentTime,
        duration: this.state.duration
      });
      this._updateProgressUI();

      // Meaningful Listening Threshold & real-time listening accumulation
      if (this.state.currentTrack && window.storageService) {
        const curSec = Math.floor(this.audio.currentTime || 0);
        if (this._lastListenSec === undefined || this._lastListenSec === null) {
          this._lastListenSec = curSec;
        }
        const delta = curSec - this._lastListenSec;
        if (delta >= 10 && delta <= 30) {
          this._lastListenSec = curSec;
          window.storageService.recordPlayDuration(this.state.currentTrack.id, delta);
        } else if (delta < 0 || delta > 30) {
          // Seeking occurred
          this._lastListenSec = curSec;
        }

        if (!this.recordedCurrentPlay) {
          const dur = this.state.duration || this.state.currentTrack.duration || 180;
          const threshold = Math.min(15, dur * 0.4);
          if (this.audio.currentTime >= threshold) {
            this.recordedCurrentPlay = true;
            window.storageService.addToHistory(this.state.currentTrack, Math.round(this.audio.currentTime));
          }
        }
      }

      // Synchronize lyrics in real time
      if (window.lyricsManager && window.lyricsManager.syncTime) {
        window.lyricsManager.syncTime(this.state.currentTime);
      }
    });

    this.audio.addEventListener("durationchange", () => {
      if (this.audio.duration && isFinite(this.audio.duration) && this.audio.duration > 0) {
        this.state.duration = this.audio.duration;
        this._updateProgressUI();
        if (window.mediaSessionManager) {
          window.mediaSessionManager.updatePositionState(this.state.currentTime, this.state.duration);
        }
      }
    });

    this.audio.addEventListener("progress", () => {
      if (this.audio.buffered && this.audio.buffered.length > 0 && this.audio.duration > 0) {
        const bufferedEnd = this.audio.buffered.end(this.audio.buffered.length - 1);
        this.state.buffered = (bufferedEnd / this.audio.duration) * 100;
        this._updateBufferUI();
      }
    });

    this.audio.addEventListener("ended", () => {
      this._handleTrackEnded();
    });

    this.audio.addEventListener("error", (e) => {
      this._handlePlaybackError(e);
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  _emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try { cb(data); } catch (e) { console.error(`AudioPlayer event listener error on ${event}:`, e); }
      });
    }
    window.dispatchEvent(new CustomEvent(`ar7:player_${event}`, { detail: data }));
  }

  /**
   * Play a track and optionally set the queue context
   */
  async playTrack(track, queueList = null) {
    if (!track || !track.id) return;

    // Race-condition prevention generation token
    const currentRequestId = ++this._playRequestId;

    // Synchronize queue
    if (queueList && window.queueManager) {
      window.queueManager.setQueue(queueList, track);
    } else if (window.queueManager) {
      // If queue is empty or only has 1 track, fill it with all available tracks from storageService
      if (window.queueManager.queue.length <= 1 && window.storageService) {
        const all = window.storageService.getAllTracks();
        if (all.length > 0) {
          window.queueManager.setQueue(all, track);
        } else if (!window.queueManager.hasTrack(track.id)) {
          window.queueManager.addToQueue(track);
        }
      } else if (!window.queueManager.hasTrack(track.id)) {
        window.queueManager.addToQueue(track);
      }
    }

    this.state.currentTrack = track;
    this.state.isLoading = true;
    this.state.currentTime = 0;
    this.recordedCurrentPlay = false;
    this.currentTrackPlayTime = 0;
    this._lastListenSec = 0;

    // Persist last played track immediately so app restart restores this exact song
    try {
      localStorage.setItem('ar7_last_played_track_id', track.id);
      localStorage.setItem('ar7_last_played_track', JSON.stringify({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.artwork,
        duration: track.duration,
        formatName: track.formatName || track.format,
        filePath: track.filePath,
        streamUrl: track.streamUrl
      }));
      if (window.storageService) {
        window.storageService.saveSettings({ lastPlayedTrackId: track.id });
      }
    } catch (e) {}

    // Emit event & update UI immediately
    this._emit("track_loaded", track);
    this._updateTrackInfoUI(track);

    // Update MediaSession & Native notification IMMEDIATELY with the new track's metadata
    if (window.mediaSessionManager) {
      window.mediaSessionManager.updateMetadata(track);
    }
    this._syncNativeNotification(true, track, true);

    // Revoke previous object URL to prevent memory leaks
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    try {
      const resolved = await AudioSourceResolver.resolveSource(track);

      // Check if a newer track was requested while resolving
      if (this._playRequestId !== currentRequestId) {
        if (resolved.isObjectUrl) URL.revokeObjectURL(resolved.url);
        return;
      }

      if (resolved.isObjectUrl) {
        this.currentObjectUrl = resolved.url;
      }

      this.audio.src = resolved.url;
      this.audio.load();

      if (!this.state.isMuted) {
        this.audio.muted = false;
        if (this.audio.volume === 0) {
          this.audio.volume = this.state.volume || 0.85;
        }
      }

      await this.audio.play();

      // Check again if a newer track request arrived while play() was awaiting
      if (this._playRequestId !== currentRequestId) {
        return;
      }

      this.state.isPlaying = true;
      this.state.isLoading = false;
      this._emit("state_changed", this.state);
      this._updateUIState();
      this._syncNativeNotification(true, track, true);

      if (window.mediaSessionManager) {
        window.mediaSessionManager.updatePlaybackState(true);
      }
    } catch (err) {
      if (this._playRequestId !== currentRequestId) return;
      console.error("[AudioPlayer] Playback failure:", err);
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this._updateUIState();
      this._syncNativeNotification(false, track, true);

      if (window.app) {
        window.app.showToast(`Unable to play "${track.title}": ${err.message}`, "error");
      }
    }
  }

  _syncNativeNotification(isPlaying, explicitTrack = null, forceImmediate = false) {
    if (!window.AndroidBridge || typeof window.AndroidBridge.updatePlaybackState !== "function") {
      return;
    }

    const track = explicitTrack || this.state.currentTrack;
    if (!track && !isPlaying) return;

    const title = track?.title || 'WAVEN';
    const artist = typeof track?.artist === 'string' ? track.artist : (track?.artist?.name || 'Local Music');
    const album = track?.album || 'Local Music';
    const artwork = track?.artwork || '';
    const duration = Math.round(Number(track?.duration) || Number(this.state.duration) || Number(this.audio?.duration) || 0) || 0;
    const current = Math.round(Number(this.state.currentTime) || Number(this.audio?.currentTime) || 0) || 0;

    const now = Date.now();
    const isSameTrack = (track?.id === this._lastSyncedTrackId);
    const isSameState = (Boolean(isPlaying) === this._lastSyncedPlaying);

    if (!forceImmediate && isSameTrack && isSameState && (now - this._lastNotificationSyncTime < 250)) {
      return;
    }

    this._lastNotificationSyncTime = now;
    this._lastSyncedTrackId = track?.id;
    this._lastSyncedPlaying = Boolean(isPlaying);

    try {
      window.AndroidBridge.updatePlaybackState(
        Boolean(isPlaying),
        String(title),
        String(artist),
        String(album),
        String(artwork),
        duration,
        current
      );
    } catch (e) {
      console.warn("[Player] Native sync error:", e);
    }
  }

  async togglePlay() {
    const now = Date.now();
    if (this._lastToggleTime && (now - this._lastToggleTime < 280)) {
      return;
    }
    this._lastToggleTime = now;

    if (!this.state.currentTrack) {
      if (window.queueManager && window.queueManager.queue.length > 0) {
        return this.playTrack(window.queueManager.queue[0]);
      }
      if (window.storageService) {
        const all = window.storageService.getAllTracks();
        if (all.length > 0) return this.playTrack(all[0], all);
      }
      if (window.app) {
        window.app.showToast("No music in library. Click '+ Add Music' to import songs.", "info");
      }
      return;
    }

    // If audio element does not have a source loaded or source is invalid, load and play
    if (!this.audio.src || this.audio.src === "" || this.audio.src === window.location.href || this.audio.error) {
      return this.playTrack(this.state.currentTrack);
    }

    if (this.audio.paused || !this.state.isPlaying) {
      this.resume();
    } else {
      this.pause();
    }
  }

  pause() {
    this.audio.pause();
    this.state.isPlaying = false;
    this._updateUIState();
    this._syncNativeNotification(false);
    if (this.state.currentTrack) {
      try {
        localStorage.setItem('ar7_last_played_track_id', this.state.currentTrack.id);
      } catch (e) {}
    }
  }

  resume() {
    if (!this.state.currentTrack) {
      this.togglePlay();
      return;
    }

    if (!this.audio.src || this.audio.src === "" || this.audio.src === window.location.href || this.audio.error) {
      this.playTrack(this.state.currentTrack);
      return;
    }

    if (!this.state.isMuted) {
      this.audio.muted = false;
      if (this.audio.volume === 0) {
        this.audio.volume = this.state.volume || 0.85;
      }
    }

    this.audio.play()
      .then(() => {
        this.state.isPlaying = true;
        this.state.isLoading = false;
        this._updateUIState();
        this._syncNativeNotification(true, this.state.currentTrack, true);
        if (window.mediaSessionManager) {
          window.mediaSessionManager.updatePlaybackState(true);
        }
      })
      .catch(e => {
        console.warn("[AudioPlayer] Resume failed, reloading audio track:", e);
        this.playTrack(this.state.currentTrack);
      });
  }

  next() {
    const now = Date.now();
    if (this._actionThrottle && (now - this._actionThrottle < 200)) return;
    this._actionThrottle = now;

    if (window.queueManager) {
      const nextTrack = window.queueManager.getNextTrack(this.state.shuffle);
      if (nextTrack) {
        this.playTrack(nextTrack);
        return;
      }
    }

    // If queueManager has no next track, check storageService or wrap around
    if (window.storageService) {
      const all = window.storageService.getAllTracks();
      if (all.length > 0) {
        if (window.queueManager) {
          window.queueManager.setQueue(all, this.state.currentTrack);
          const nextTrack = window.queueManager.getNextTrack(this.state.shuffle);
          if (nextTrack) {
            this.playTrack(nextTrack);
            return;
          }
        }
        // Wrap around to first track
        this.playTrack(all[0], all);
        return;
      }
    }

    if (window.queueManager && window.queueManager.queue.length > 0) {
      window.queueManager.currentIndex = 0;
      window.queueManager.saveQueueState();
      window.queueManager.render();
      this.playTrack(window.queueManager.queue[0]);
    } else {
      this.pause();
      this.seek(0);
    }
  }

  previous() {
    const now = Date.now();
    if (this._actionThrottle && (now - this._actionThrottle < 200)) return;
    this._actionThrottle = now;

    if (this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }

    if (window.queueManager) {
      const prevTrack = window.queueManager.getPreviousTrack();
      if (prevTrack) {
        this.playTrack(prevTrack);
        return;
      }
    }

    // If queueManager has no prev track, check storageService
    if (window.storageService) {
      const all = window.storageService.getAllTracks();
      if (all.length > 0) {
        if (window.queueManager) {
          window.queueManager.setQueue(all, this.state.currentTrack);
          const prevTrack = window.queueManager.getPreviousTrack();
          if (prevTrack) {
            this.playTrack(prevTrack);
            return;
          }
        }
        this.playTrack(all[all.length - 1], all);
        return;
      }
    }

    if (window.queueManager && window.queueManager.queue.length > 0) {
      const lastIdx = window.queueManager.queue.length - 1;
      window.queueManager.currentIndex = lastIdx;
      window.queueManager.saveQueueState();
      window.queueManager.render();
      this.playTrack(window.queueManager.queue[lastIdx]);
    } else {
      this.seek(0);
    }
  }

  startScrubbing() {
    this.isScrubbing = true;
    this.state.isSeeking = true;
    this.wasPlayingBeforeScrub = Boolean(this.state.isPlaying || !this.audio.paused);
  }

  endScrubbing(fractionOrSeconds) {
    this.isScrubbing = false;
    let targetSeconds = 0;
    const dur = this.state.duration || (this.audio && isFinite(this.audio.duration) ? this.audio.duration : 0);

    if (fractionOrSeconds !== undefined && fractionOrSeconds !== null) {
      if (fractionOrSeconds >= 0 && fractionOrSeconds <= 1 && dur > 0) {
        targetSeconds = fractionOrSeconds * dur;
      } else {
        targetSeconds = Number(fractionOrSeconds);
      }
    } else {
      targetSeconds = this.state.currentTime;
    }

    this.seek(targetSeconds);
  }

  seek(timeInSeconds) {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return;
    const dur = this.state.duration || (this.audio && isFinite(this.audio.duration) ? this.audio.duration : 0);
    const target = Math.max(0, Math.min(timeInSeconds, dur > 0 ? dur : timeInSeconds));

    this.state.currentTime = target;
    this._updateProgressUI();

    // If the track is currently playing or supposed to be playing, preserve playing state
    if (this.state.isPlaying || !this.audio.paused) {
      this.wasPlayingBeforeScrub = true;
    }

    // If audio is currently seeking in the browser media engine, queue this target
    // to avoid aborting the browser decoding pipeline with rapid consecutive seeks
    if (this.audio.seeking) {
      this.pendingSeekTarget = target;
      return;
    }

    try {
      this.audio.currentTime = target;
    } catch (e) {
      console.warn("[AudioPlayer] seek currentTime set error:", e);
    }
  }

  seekTo(timeInSeconds) {
    return this.seek(timeInSeconds);
  }

  seekByPercentage(percentage) {
    const fraction = Math.max(0, Math.min(percentage, 1));
    const dur = this.state.duration || (this.audio && isFinite(this.audio.duration) ? this.audio.duration : 0);
    this.seek(fraction * dur);
  }

  playNext() {
    return this.next();
  }

  playPrevious() {
    return this.previous();
  }

  setVolume(vol) {
    const clamped = Math.max(0, Math.min(vol, 1));
    this.state.volume = clamped;
    this.state.isMuted = clamped === 0;
    this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
    this._updateVolumeUI();
    if (window.storageService) {
      window.storageService.saveSettings({ volume: this.state.volume, isMuted: this.state.isMuted });
    }
  }

  toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
    this._updateVolumeUI();
    if (window.storageService) {
      window.storageService.saveSettings({ isMuted: this.state.isMuted });
    }
  }

  setCrossfade(seconds) {
    this.crossfadeSecs = Math.max(0, Math.min(Number(seconds) || 0, 12));
    if (window.storageService) {
      window.storageService.saveSettings({ crossfade: this.crossfadeSecs });
    }
  }

  setNormalization(enabled) {
    this.normalizeVolume = Boolean(enabled);
    if (this.audio) {
      const baseVol = this.state.volume || 0.85;
      this.audio.volume = this.normalizeVolume ? Math.min(baseVol, 0.82) : baseVol;
    }
    if (window.storageService) {
      window.storageService.saveSettings({ normalize: this.normalizeVolume });
    }
  }

  toggleShuffle() {
    // Cycles: false (off) -> 'normal' (on) -> 'smart' (Smart Shuffle ✨) -> false
    if (!this.state.shuffle) {
      this.state.shuffle = true;
      this.state.isSmartShuffle = false;
      if (window.queueManager) window.queueManager.isSmartShuffle = false;
      if (window.app) window.app.showToast("Shuffle: ON (Random)", "info");
    } else if (!this.state.isSmartShuffle) {
      this.state.shuffle = true;
      this.state.isSmartShuffle = true;
      if (window.queueManager) window.queueManager.isSmartShuffle = true;
      if (window.app) window.app.showToast("Smart Shuffle: Active (Vibe-Weighted ✨)", "info");
    } else {
      this.state.shuffle = false;
      this.state.isSmartShuffle = false;
      if (window.queueManager) window.queueManager.isSmartShuffle = false;
      if (window.app) window.app.showToast("Shuffle: OFF", "info");
    }

    this._updateShuffleUI();
    if (window.storageService) {
      window.storageService.saveSettings({
        shuffle: this.state.shuffle,
        isSmartShuffle: this.state.isSmartShuffle
      });
    }
  }

  _updateShuffleUI() {
    document.querySelectorAll(".btn-shuffle-toggle").forEach(btn => {
      btn.classList.toggle("active", Boolean(this.state.shuffle));
      btn.classList.toggle("smart-active", Boolean(this.state.isSmartShuffle));
      if (this.state.isSmartShuffle) {
        btn.setAttribute("title", "Smart Shuffle (Active ✨) - Click to turn OFF");
      } else if (this.state.shuffle) {
        btn.setAttribute("title", "Shuffle (ON) - Click for Smart Shuffle");
      } else {
        btn.setAttribute("title", "Shuffle (OFF)");
      }
    });
  }

  toggleRepeat() {
    // Cycles: 'off' -> 'all' -> 'one' -> 'off'
    if (this.state.repeatMode === "off") {
      this.state.repeatMode = "all";
    } else if (this.state.repeatMode === "all") {
      this.state.repeatMode = "one";
    } else {
      this.state.repeatMode = "off";
    }

    this._updateRepeatUI();
    if (window.storageService) {
      window.storageService.saveSettings({ repeatMode: this.state.repeatMode });
    }

    const labels = { off: "Repeat OFF", all: "Repeat ALL tracks", one: "Repeat ONE track" };
    if (window.app) {
      window.app.showToast(labels[this.state.repeatMode], "info");
    }
  }

  _handleTrackEnded() {
    // 1. Record play & complete remaining track listening seconds
    if (this.state.currentTrack && window.storageService) {
      if (!this.recordedCurrentPlay) {
        this.recordedCurrentPlay = true;
        window.storageService.addToHistory(this.state.currentTrack, Math.round(this.audio.duration || 180));
      } else {
        const fullDur = Math.round(this.audio.duration || this.state.duration || 0);
        if (fullDur > (this._lastListenSec || 15)) {
          window.storageService.recordPlayDuration(this.state.currentTrack.id, fullDur - (this._lastListenSec || 15));
        }
      }
    }

    // 2. Check Sleep Timer end-of-track
    if (this.sleepTimerMode === "track") {
      this.pause();
      this.clearSleepTimer();
      if (window.app) window.app.showToast("Sleep timer: Playback stopped at end of track", "info");
      return;
    }

    if (this.state.repeatMode === "one") {
      this.seek(0);
      this.audio.play().catch(e => console.warn(e));
      return;
    }

    this.next();
  }

  getAudioElement() {
    return this.audio;
  }

  setSleepTimer(minutes) {
    this.clearSleepTimer();
    if (minutes === "track") {
      this.sleepTimerMode = "track";
      if (window.app) window.app.showToast("Sleep timer: Stop after current song", "info");
      return;
    }
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins <= 0) return;

    this.sleepTimerMode = mins;
    this.sleepTimerTarget = Date.now() + (mins * 60 * 1000);

    this.sleepTimerInterval = setInterval(() => {
      const remaining = this.sleepTimerTarget - Date.now();
      if (remaining <= 0) {
        this.pause();
        this.clearSleepTimer();
        if (window.app) window.app.showToast("Sleep timer finished: Playback paused", "info");
      } else if (remaining <= 15000 && this.state.isPlaying) {
        // Smoothly fade out volume over last 15 seconds
        const fadeRatio = remaining / 15000;
        this.audio.volume = Math.max(0, this.state.volume * fadeRatio);
      }
    }, 1000);

    if (window.app) window.app.showToast(`Sleep timer set for ${mins} minutes`, "info");
  }

  clearSleepTimer() {
    if (this.sleepTimerInterval) {
      clearInterval(this.sleepTimerInterval);
      this.sleepTimerInterval = null;
    }
    this.sleepTimerMode = null;
    this.sleepTimerTarget = null;
    this.audio.volume = this.state.volume;
  }

  _handlePlaybackError(e) {
    console.warn("[AudioPlayer] Error event encountered:", e);
    this.state.isLoading = false;
    this.state.isPlaying = false;
    this._updateUIState();

    if (window.app && this.state.currentTrack) {
      window.app.showToast(`Error playing "${this.state.currentTrack.title}". Skipping to next track.`, "error");
    }

    setTimeout(() => {
      this.next();
    }, 1500);
  }

  // -------------------------------------------------------------
  // UI SYNCHRONIZATION HELPERS
  // -------------------------------------------------------------

  _updateTrackInfoUI(track) {
    // 1. Update all title elements (using aria-label, no tooltip popup)
    document.querySelectorAll(".player-track-title").forEach(el => {
      el.textContent = track.title || "Unknown Title";
      el.removeAttribute("title");
      el.setAttribute("aria-label", track.title || "Track Title");
    });

    // 2. Update all artist elements
    document.querySelectorAll(".player-track-artist").forEach(el => {
      el.textContent = track.artist || "Unknown Artist";
      el.removeAttribute("title");
    });

    // 3. Update all album elements
    document.querySelectorAll(".player-track-album").forEach(el => {
      el.textContent = track.album || "";
      el.removeAttribute("title");
    });

    // 4. Update all artwork elements
    const artSrc = window.getTrackArtwork ? window.getTrackArtwork(track) : (track.artwork || "assets/covers/default_cover.svg");
    document.querySelectorAll(".player-track-artwork").forEach(img => {
      img.src = artSrc;
      img.dataset.title = track.title || "";
      img.dataset.artist = track.artist || "";
      img.onerror = () => {
        if (window.handleTrackImgError) {
          window.handleTrackImgError(img, track.title, track.artist);
        } else {
          img.src = "assets/covers/default_cover.svg";
        }
      };
    });

    // 5. Update Right Hero Player Card background & metadata
    const heroBg = document.getElementById("player-card-bg");
    if (heroBg) {
      const pal = (window.MetadataParser && window.MetadataParser.getPaletteForTrack)
        ? window.MetadataParser.getPaletteForTrack(track.title, track.artist)
        : { c1: "#3b82f6", c2: "#1d4ed8" };
      heroBg.style.transition = "background 0.8s ease, background-image 0.8s ease";
      heroBg.style.background = `radial-gradient(circle at 50% 30%, ${pal.c1}55 0%, ${pal.c2}33 60%, #0d0f14 95%), url('${artSrc}')`;
      heroBg.style.backgroundSize = "cover";
      heroBg.style.backgroundPosition = "center";
    }
    const heroBadge = document.getElementById("player-card-badge");
    if (heroBadge) {
      heroBadge.textContent = track.badge || (track.isLocal ? "Local audio" : "Now playing");
    }
    const heroFormat = document.getElementById("hero-player-format");
    if (heroFormat) {
      const ext = (track.fileType || track.format || "").toUpperCase();
      heroFormat.textContent = ext ? `${ext} • LOCAL` : "LOCAL AUDIO";
    }

    // 6. Update Favorite/Heart buttons
    this.updateHeartUI();

    // 7. Highlight active track in all visible track rows
    document.querySelectorAll(".waven-track-row, .track-row").forEach(row => {
      if (row.getAttribute("data-track-id") === track.id) {
        row.classList.add("active-playing", "active-selected");
      } else {
        row.classList.remove("active-playing", "active-selected");
      }
    });

    if (window.app) {
      if (window.app.updateCardPlayButtons) window.app.updateCardPlayButtons();
      if (window.app.updateActiveTitleAnimations) window.app.updateActiveTitleAnimations();
    }
  }

  async toggleLike() {
    let track = this.state.currentTrack;
    if (!track && window.queueManager && window.queueManager.queue.length > 0) {
      track = window.queueManager.getCurrentTrack();
      this.state.currentTrack = track;
    }
    if (!track && window.storageService) {
      const all = window.storageService.getAllTracks();
      if (all.length > 0) {
        track = all[0];
        this.state.currentTrack = track;
      }
    }
    if (!track || !window.storageService) return;

    const isNowLiked = await window.storageService.toggleLike(track);
    this.updateHeartUI();
    if (window.app && window.app.showToast) {
      window.app.showToast(isNowLiked ? "Added to Favourites" : "Removed from Favourites", "info");
    }
  }

  updateHeartUI() {
    let track = this.state.currentTrack;
    if (!track && window.queueManager && window.queueManager.queue.length > 0) {
      track = window.queueManager.getCurrentTrack();
    }
    if (!track && window.storageService) {
      const all = window.storageService.getAllTracks();
      if (all.length > 0) track = all[0];
    }
    if (!track) return;

    const isLiked = Boolean(window.storageService?.isLiked(track.id));
    document.querySelectorAll(".player-heart-btn, .mini-heart-btn").forEach(btn => {
      btn.classList.toggle("active", isLiked);
      const svg = btn.querySelector("svg");
      if (svg) {
        if (isLiked) {
          svg.setAttribute("fill", "#ef4444");
          svg.setAttribute("stroke", "#ef4444");
          svg.style.fill = "#ef4444";
          svg.style.stroke = "#ef4444";
        } else {
          svg.setAttribute("fill", "none");
          svg.setAttribute("stroke", "currentColor");
          svg.style.fill = "none";
          svg.style.stroke = "currentColor";
        }
      }
    });
  }

  _updateUIState() {
    const isPlaying = this.state.isPlaying;

    // Update all play/pause buttons with play or pause icons
    document.querySelectorAll(".play-toggle-btn").forEach(btn => {
      if (isPlaying) {
        btn.classList.add("playing");
        btn.setAttribute("title", "Pause (Space)");
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"></rect><rect x="14" y="4" width="4" height="16" rx="1.5"></rect></svg>`;
      } else {
        btn.classList.remove("playing");
        btn.setAttribute("title", "Play (Space)");
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      }
    });

    // Animate artwork on desktop panel when playing
    document.querySelectorAll(".desktop-now-playing-panel .big-artwork-container").forEach(el => {
      if (isPlaying) {
        el.classList.add("playing-pulse");
      } else {
        el.classList.remove("playing-pulse");
      }
    });

    if (window.immersiveManager && typeof window.immersiveManager.updatePlayState === "function") {
      window.immersiveManager.updatePlayState(isPlaying);
    }
  }

  _updateProgressUI() {
    const cur = this.state.currentTime;
    const dur = this.state.duration || (this.state.currentTrack?.duration || 0);
    const pct = dur > 0 ? (cur / dur) * 100 : 0;

    // Time text
    document.querySelectorAll(".time-stamp.current").forEach(el => {
      el.textContent = this.formatTime(cur);
    });

    document.querySelectorAll(".time-stamp.duration").forEach(el => {
      el.textContent = this.formatTime(dur);
    });

    // Seek bar fill & thumb
    document.querySelectorAll(".seek-bar-fill").forEach(el => {
      el.style.width = `${pct}%`;
    });

    document.querySelectorAll(".seek-bar-thumb").forEach(el => {
      el.style.left = `${pct}%`;
    });
  }

  _updateBufferUI() {
    document.querySelectorAll(".seek-bar-buffer").forEach(el => {
      el.style.width = `${this.state.buffered}%`;
    });
  }

  _updateVolumeUI() {
    const vol = this.state.isMuted ? 0 : this.state.volume;
    const pct = vol * 100;

    document.querySelectorAll(".volume-slider-fill").forEach(el => {
      el.style.width = `${pct}%`;
    });

    document.querySelectorAll(".volume-slider-thumb").forEach(el => {
      el.style.left = `${pct}%`;
    });

    document.querySelectorAll(".btn-mute-toggle").forEach(btn => {
      if (this.state.isMuted || vol === 0) {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>`;
        btn.setAttribute("title", "Unmute (M)");
      } else if (vol < 0.5) {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        btn.setAttribute("title", "Mute (M)");
      } else {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        btn.setAttribute("title", "Mute (M)");
      }
    });
  }

  _updateShuffleUI() {
    document.querySelectorAll(".btn-shuffle-toggle").forEach(btn => {
      if (this.state.shuffle) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  _updateRepeatUI() {
    document.querySelectorAll(".btn-repeat-toggle").forEach(btn => {
      btn.classList.remove("active", "repeat-one");
      if (this.state.repeatMode === "all") {
        btn.classList.add("active");
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;
      } else if (this.state.repeatMode === "one") {
        btn.classList.add("active", "repeat-one");
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><text x="12" y="15" font-size="9" font-weight="800" text-anchor="middle" fill="currentColor">1</text></svg>`;
      } else {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;
      }
    });
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

window.player = new AudioPlayer();
