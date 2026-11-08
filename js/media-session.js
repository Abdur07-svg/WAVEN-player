/**
 * AR7 MUSIC — MEDIA SESSION API INTEGRATION
 * Integrates lock-screen, smartwatch, and notification audio controls on Android, iOS & Desktop.
 */

class MediaSessionManager {
  constructor() {
    this.isSupported = 'mediaSession' in navigator;
    if (this.isSupported) {
      this._initHandlers();
    }
    this._bindPlayerEvents();
  }

  _initHandlers() {
    if (!this.isSupported) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (window.player) window.player.resume();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (window.player) window.player.pause();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (window.player) window.player.previous();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (window.player) window.player.next();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && window.player) {
          window.player.seek(details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (window.player) {
          const skipTime = details.seekOffset || 10;
          window.player.seek(window.player.state.currentTime - skipTime);
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (window.player) {
          const skipTime = details.seekOffset || 10;
          window.player.seek(window.player.state.currentTime + skipTime);
        }
      });
    } catch (e) {
      console.warn("[MediaSession] Action handler registration issue:", e);
    }
  }

  _bindPlayerEvents() {
    window.addEventListener("ar7:player_track_loaded", (e) => {
      this.updateMetadata(e.detail);
    });

    window.addEventListener("ar7:player_state_changed", (e) => {
      this.updatePlaybackState(e.detail?.isPlaying);
    });

    window.addEventListener("ar7:player_time_updated", (e) => {
      this.updatePositionState(e.detail?.currentTime, e.detail?.duration);
    });
  }

  update(track) {
    this.updateMetadata(track);
  }

  updateMetadata(track) {
    if (!track) return;

    if (this.isSupported) {
      const titleStr = track.title || 'Unknown Title';
      const artistStr = typeof track.artist === 'string' ? track.artist : (track.artist?.name || 'Local Music');
      const albumStr = track.album || 'Local Music';

      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: titleStr,
          artist: artistStr,
          album: albumStr,
          artwork: []
        });
      } catch (err) {
        console.warn("[MediaSession] Failed to set MediaMetadata:", err);
      }
    }
  }

  updatePlaybackState(isPlaying) {
    if (this.isSupported) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
      } catch (e) {}
    }
  }

  updatePositionState(currentTime, duration) {
    if (this.isSupported && !isNaN(duration) && duration > 0) {
      try {
        if ('setPositionState' in navigator.mediaSession) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, duration),
            playbackRate: 1.0,
            position: Math.max(0, Math.min(currentTime, duration))
          });
        }
      } catch (e) {}
    }
  }
}

window.mediaSessionManager = new MediaSessionManager();
