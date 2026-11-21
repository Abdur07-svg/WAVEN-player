/**
 * WAVEN — Playback State & Queue Controller
 */

class PlayerController {
  constructor() {
    this.audioEngine = window.wavenAudioEngine;
    this.library = window.wavenLibrary;
    this.lyricsManager = window.wavenLyricsManager;

    this.queue = [];
    this.currentIndex = -1;
    this.currentTrack = null;

    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;

    this.isShuffle = false;
    this.repeatMode = 0; // 0: off, 1: all, 2: one

    this.progressInterval = null;
    this.initEventListeners();
  }

  initEventListeners() {
    // WebAudio element events (fallback)
    if (this.audioEngine && this.audioEngine.audioElement) {
      const el = this.audioEngine.audioElement;
      el.addEventListener('play', () => this.onPlayStateChanged(true));
      el.addEventListener('pause', () => this.onPlayStateChanged(false));
      el.addEventListener('timeupdate', () => {
        this.currentTime = el.currentTime;
        this.duration = el.duration || this.duration;
        this.updateProgressUI();
        if (this.lyricsManager) this.lyricsManager.update(this.currentTime);
      });
      el.addEventListener('ended', () => this.handleTrackEnded());
    }

    // Native app periodic poll/heartbeat if running inside Android APK
    if (this.audioEngine.isNative) {
      this.progressInterval = setInterval(() => {
        if (this.isPlaying && this.audioEngine.nativeBridge) {
          const pos = this.audioEngine.getCurrentPosition() / 1000;
          const dur = this.audioEngine.getDuration() / 1000;
          if (dur > 0) {
            this.currentTime = pos;
            this.duration = dur;
            this.updateProgressUI();
            if (this.lyricsManager) this.lyricsManager.update(this.currentTime);
          }
        }
      }, 500);
    }
  }

  setQueue(tracks, startIndex = 0) {
    this.queue = [...tracks];
    this.currentIndex = startIndex;
    if (this.queue.length > 0) {
      this.playTrack(this.queue[this.currentIndex]);
    }
  }

  playTrack(track) {
    if (!track) return;
    this.currentTrack = track;
    this.currentTime = 0;
    this.duration = track.duration || 151;
    this.isPlaying = true;

    if (this.library) {
      this.library.addToHistory(track);
    }

    this.audioEngine.playTrack(track);
    this.updateTrackMetaUI(track);
    this.updatePlayPauseUI(true);
    this.updateProgressUI();
  }

  togglePlayPause() {
    if (!this.currentTrack) {
      const tracks = this.library.getAllTracks();
      if (tracks.length > 0) {
        this.setQueue(tracks, 0);
        return;
      }
    }
    this.isPlaying = !this.isPlaying;
    this.audioEngine.togglePlayPause();
    this.updatePlayPauseUI(this.isPlaying);
  }

  resume() {
    this.isPlaying = true;
    this.audioEngine.resume();
    this.updatePlayPauseUI(true);
  }

  pause() {
    this.isPlaying = false;
    this.audioEngine.pause();
    this.updatePlayPauseUI(false);
  }

  playNext() {
    if (this.queue.length === 0) return;
    if (this.isShuffle) {
      this.currentIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.queue.length;
    }
    this.playTrack(this.queue[this.currentIndex]);
  }

  playPrevious() {
    if (this.queue.length === 0) return;
    if (this.currentTime > 3) {
      this.seekTo(0);
      return;
    }
    this.currentIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    this.playTrack(this.queue[this.currentIndex]);
  }

  seekTo(seconds) {
    this.currentTime = seconds;
    this.audioEngine.seekTo(seconds);
    this.updateProgressUI();
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    const shuffleBtns = document.querySelectorAll('.btn-shuffle');
    shuffleBtns.forEach(btn => {
      if (this.isShuffle) {
        btn.classList.add('text-primary-fixed');
        btn.classList.remove('text-on-surface-variant');
      } else {
        btn.classList.remove('text-primary-fixed');
        btn.classList.add('text-on-surface-variant');
      }
    });
  }

  cycleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    const repeatBtns = document.querySelectorAll('.btn-repeat');
    repeatBtns.forEach(btn => {
      const icon = btn.querySelector('.material-symbols-outlined');
      if (this.repeatMode === 0) {
        btn.classList.remove('text-primary-fixed');
        btn.classList.add('text-on-surface-variant');
        if (icon) icon.textContent = 'repeat';
      } else if (this.repeatMode === 1) {
        btn.classList.add('text-primary-fixed');
        btn.classList.remove('text-on-surface-variant');
        if (icon) icon.textContent = 'repeat';
      } else {
        btn.classList.add('text-primary-fixed');
        btn.classList.remove('text-on-surface-variant');
        if (icon) icon.textContent = 'repeat_one';
      }
    });
  }

  handleTrackEnded() {
    if (this.repeatMode === 2) {
      this.seekTo(0);
      this.resume();
    } else if (this.repeatMode === 1 || this.currentIndex < this.queue.length - 1) {
      this.playNext();
    } else {
      this.isPlaying = false;
      this.updatePlayPauseUI(false);
    }
  }

  onPlayStateChanged(isPlaying) {
    this.isPlaying = isPlaying;
    this.updatePlayPauseUI(isPlaying);
  }

  formatTime(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  updateTrackMetaUI(track) {
    // Update Now Playing Modal Metadata
    const npTitle = document.getElementById('np-title');
    const npArtist = document.getElementById('np-artist');
    const npArt = document.getElementById('np-cover-art');
    const lyricsTitle = document.getElementById('lyrics-track-title');
    const lyricsArtist = document.getElementById('lyrics-track-artist');

    if (npTitle) npTitle.textContent = track.title;
    if (npArtist) npArtist.innerHTML = `${track.artist} <span class="mx-1 opacity-40">•</span> ${track.album || 'Lossless Album'}`;
    if (npArt && track.coverArt) {
      npArt.style.backgroundImage = `url('${track.coverArt}')`;
    }

    if (lyricsTitle) lyricsTitle.textContent = track.title;
    if (lyricsArtist) lyricsArtist.textContent = `${track.artist} • ${track.album || 'Lossless Album'}`;

    // Update Mini Player
    const miniTitle = document.getElementById('mini-title');
    const miniArtist = document.getElementById('mini-artist');
    const miniCover = document.getElementById('mini-cover-img');
    const miniEqBars = document.getElementById('mini-eq-bars');
    if (miniTitle) miniTitle.textContent = track.title;
    if (miniArtist) miniArtist.textContent = `${track.artist} • High-Res Lossless`;
    if (miniCover && track.coverArt) {
      miniCover.src = track.coverArt;
      miniCover.classList.remove('hidden');
      if (miniEqBars) miniEqBars.classList.add('hidden');
    }

    // Update Favorite Buttons state
    const isFav = this.library.isFavorite(track.id);
    this.updateFavoriteUI(isFav);
  }

  updatePlayPauseUI(isPlaying) {
    const iconName = isPlaying ? 'pause' : 'play_arrow';

    // Now Playing Big CTA Button
    const npPlayIcon = document.getElementById('np-play-icon');
    if (npPlayIcon) npPlayIcon.textContent = iconName;

    // Mini Player Play Button
    const miniPlayIcon = document.getElementById('mini-play-icon');
    if (miniPlayIcon) miniPlayIcon.textContent = iconName;

    // Lyrics Footer Play Button
    const lyricsPlayIcon = document.getElementById('lyrics-play-icon');
    if (lyricsPlayIcon) lyricsPlayIcon.textContent = iconName;

    // Animated Equalizer in Mini Player
    const miniEqBars = document.getElementById('mini-eq-bars');
    if (miniEqBars) {
      miniEqBars.style.opacity = isPlaying ? '1' : '0.4';
    }
  }

  updateProgressUI() {
    const elapsed = this.currentTime;
    const dur = Math.max(1, this.duration);
    const percent = Math.min(100, Math.max(0, (elapsed / dur) * 100));

    // Scrubber elements
    const progressBar = document.getElementById('np-progress-bar');
    const scrubberThumb = document.getElementById('np-scrubber-thumb');
    const timeElapsed = document.getElementById('np-time-elapsed');
    const timeRemaining = document.getElementById('np-time-remaining');

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (scrubberThumb) scrubberThumb.style.left = `${percent}%`;
    if (timeElapsed) timeElapsed.textContent = this.formatTime(elapsed);
    if (timeRemaining) timeRemaining.textContent = `-${this.formatTime(dur - elapsed)}`;

    // Mini Player bottom progress line
    const miniProgress = document.getElementById('mini-progress-line');
    if (miniProgress) miniProgress.style.width = `${percent}%`;

    // Lyrics transport progress line
    const lyricsProgress = document.getElementById('lyrics-progress-bar');
    const lyricsElapsed = document.getElementById('lyrics-time-elapsed');
    const lyricsTotal = document.getElementById('lyrics-time-total');
    if (lyricsProgress) lyricsProgress.style.width = `${percent}%`;
    if (lyricsElapsed) lyricsElapsed.textContent = this.formatTime(elapsed);
    if (lyricsTotal) lyricsTotal.textContent = this.formatTime(dur);
  }

  updateFavoriteUI(isFav) {
    const favIcons = document.querySelectorAll('.fav-icon-toggle');
    favIcons.forEach(icon => {
      icon.style.fontVariationSettings = isFav ? "'FILL' 1" : "'FILL' 0";
      if (isFav) {
        icon.classList.add('text-secondary-fixed');
      } else {
        icon.classList.remove('text-secondary-fixed');
      }
    });
  }
}

window.wavenPlayer = new PlayerController();
