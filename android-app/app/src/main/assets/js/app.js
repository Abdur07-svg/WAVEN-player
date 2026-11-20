/**
 * WAVEN — Main Application Coordinator & View Router
 */

class WavenApp {
  constructor() {
    this.currentView = 'home';
    this.previousView = 'home';
    this.isNowPlayingOpen = false;
    this.isLyricsOpen = false;

    this.player = window.wavenPlayer;
    this.library = window.wavenLibrary;
    this.audioEngine = window.wavenAudioEngine;
    this.lyricsManager = window.wavenLyricsManager;

    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindPlayerControls();
    this.bindEqualizerControls();
    this.bindLibraryControls();
    this.bindExploreControls();
    this.bindLyricsControls();
    this.renderHome();
    this.renderLibrary();
    this.renderExplore();

    // Default load first track into player ready state
    const allTracks = this.library.getAllTracks();
    if (allTracks.length > 0) {
      this.player.queue = [...allTracks];
      this.player.currentIndex = 0;
      this.player.currentTrack = allTracks[0];
      this.player.duration = allTracks[0].duration;
      this.player.updateTrackMetaUI(allTracks[0]);
    }
  }

  // View Navigation
  navigateTo(viewName) {
    if (this.currentView === viewName) return;
    this.previousView = this.currentView;
    this.currentView = viewName;

    // Hide all views
    document.querySelectorAll('.view-container').forEach(view => {
      view.classList.remove('active');
    });

    // Show target view
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }

    // Update bottom navigation dock active pill
    document.querySelectorAll('#bottom-nav a[data-path]').forEach(a => {
      const path = a.getAttribute('data-path');
      if (path === viewName) {
        a.className = 'flex items-center justify-center w-12 h-12 rounded-full transition-all bg-primary-container text-on-primary-container shadow-md';
      } else {
        a.className = 'flex items-center justify-center w-12 h-12 rounded-full text-on-surface-variant hover:text-on-surface transition-all';
      }
    });
  }

  openNowPlaying() {
    this.isNowPlayingOpen = true;
    const modal = document.getElementById('view-now-playing');
    if (modal) modal.classList.add('open');
  }

  closeNowPlaying() {
    this.isNowPlayingOpen = false;
    const modal = document.getElementById('view-now-playing');
    if (modal) modal.classList.remove('open');
  }

  openLyrics() {
    this.isLyricsOpen = true;
    const modal = document.getElementById('view-lyrics');
    if (modal) modal.classList.add('open');
    if (this.lyricsManager) this.lyricsManager.render();
  }

  closeLyrics() {
    this.isLyricsOpen = false;
    const modal = document.getElementById('view-lyrics');
    if (modal) modal.classList.remove('open');
  }

  openPlaylistDetails(playlistId) {
    const pl = this.library.getPlaylists().find(p => p.id === playlistId) || this.library.getPlaylists()[0];
    const titleEl = document.getElementById('pl-detail-title');
    const curatorEl = document.getElementById('pl-detail-curator');
    const tracklistEl = document.getElementById('pl-detail-tracklist');

    if (titleEl) titleEl.textContent = pl.title;
    if (curatorEl) curatorEl.textContent = `Curated by ${pl.curator} • ${pl.trackCount} Songs • ${pl.duration}`;

    // Render tracks
    if (tracklistEl) {
      const tracks = this.library.getAllTracks();
      tracklistEl.innerHTML = tracks.map((t, i) => {
        const isCurrent = this.player.currentTrack && this.player.currentTrack.id === t.id;
        return `
          <div class="track-row group relative flex items-center justify-between p-space-sm rounded-DEFAULT ${isCurrent ? 'bg-surface-container-low/70' : 'hover:bg-surface-container-low'} transition-all cursor-pointer" onclick="window.wavenApp.playSpecificTrack('${t.id}')">
            <div class="flex items-center gap-space-md min-w-0 flex-1">
              <div class="w-7 h-7 flex items-center justify-center shrink-0">
                ${isCurrent && this.player.isPlaying ? `
                  <div class="flex items-end gap-0.5 h-4">
                    <span class="w-[3px] bg-primary-fixed rounded-full eq-bar-1"></span>
                    <span class="w-[3px] bg-primary-fixed rounded-full eq-bar-2"></span>
                    <span class="w-[3px] bg-primary-fixed rounded-full eq-bar-3"></span>
                    <span class="w-[3px] bg-primary-fixed rounded-full eq-bar-4"></span>
                  </div>
                ` : `
                  <span class="text-center font-label-md text-label-md text-on-surface-variant group-hover:hidden">${(i + 1).toString().padStart(2, '0')}</span>
                  <span class="material-symbols-outlined text-[20px] text-primary hidden group-hover:block">play_arrow</span>
                `}
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-label-lg text-label-lg ${isCurrent ? 'text-primary-fixed font-bold' : 'text-primary'} truncate">${t.title}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${t.artist}</p>
              </div>
            </div>
            <div class="flex items-center gap-space-sm shrink-0 ml-space-sm">
              <span class="font-label-sm text-label-sm ${isCurrent ? 'text-primary-fixed font-semibold' : 'text-on-surface-variant'}">${this.player.formatTime(t.duration)}</span>
              <button class="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface transition-colors" onclick="event.stopPropagation(); window.wavenApp.toggleFavorite('${t.id}')">
                <span class="material-symbols-outlined text-[20px] ${this.library.isFavorite(t.id) ? 'text-secondary-fixed icon-filled' : ''}">favorite</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    this.navigateTo('playlist-details');
  }

  handleBackPress() {
    if (this.isLyricsOpen) {
      this.closeLyrics();
      return true;
    }
    if (this.isNowPlayingOpen) {
      this.closeNowPlaying();
      return true;
    }
    if (this.currentView === 'playlist-details' || this.currentView === 'settings') {
      this.navigateTo(this.previousView || 'home');
      return true;
    }
    return false;
  }

  // Navigation Dock Binding
  bindNavigation() {
    document.querySelectorAll('#bottom-nav a[data-path]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const path = a.getAttribute('data-path');
        this.navigateTo(path);
      });
    });

    // Mini Player Click -> Open Now Playing
    const miniPlayer = document.getElementById('mini-player');
    if (miniPlayer) {
      miniPlayer.addEventListener('click', (e) => {
        // Prevent toggle if clicking play button directly
        if (e.target.closest('#mini-play-btn') || e.target.closest('#mini-fav-btn')) return;
        this.openNowPlaying();
      });
    }

    // Now Playing dismiss
    const dismissNp = document.getElementById('np-dismiss-btn');
    if (dismissNp) {
      dismissNp.addEventListener('click', () => this.closeNowPlaying());
    }

    // Now Playing lyrics teaser click -> Open Lyrics Sheet
    const lyricsTeaser = document.getElementById('np-lyrics-teaser');
    if (lyricsTeaser) {
      lyricsTeaser.addEventListener('click', () => this.openLyrics());
    }

    // Lyrics dismiss
    const dismissLyrics = document.getElementById('lyrics-dismiss-btn');
    if (dismissLyrics) {
      dismissLyrics.addEventListener('click', () => this.closeLyrics());
    }

    // Playlist Details back button
    const plBack = document.getElementById('pl-back-btn');
    if (plBack) {
      plBack.addEventListener('click', () => this.navigateTo(this.previousView || 'home'));
    }

    // Settings back button
    const settingsBack = document.getElementById('settings-back-btn');
    if (settingsBack) {
      settingsBack.addEventListener('click', () => this.navigateTo(this.previousView || 'home'));
    }
  }

  // Player Controls Binding
  bindPlayerControls() {
    // Mini Player Play/Pause
    const miniPlay = document.getElementById('mini-play-btn');
    if (miniPlay) {
      miniPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.player.togglePlayPause();
      });
    }

    // Mini Player Favorite
    const miniFav = document.getElementById('mini-fav-btn');
    if (miniFav) {
      miniFav.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.player.currentTrack) {
          const isFav = this.library.toggleFavorite(this.player.currentTrack.id);
          this.player.updateFavoriteUI(isFav);
        }
      });
    }

    // Now Playing Play/Pause Big CTA
    const npPlay = document.getElementById('np-play-btn');
    if (npPlay) {
      npPlay.addEventListener('click', () => this.player.togglePlayPause());
    }

    // Now Playing Prev / Next
    const npPrev = document.getElementById('np-prev-btn');
    if (npPrev) npPrev.addEventListener('click', () => this.player.playPrevious());

    const npNext = document.getElementById('np-next-btn');
    if (npNext) npNext.addEventListener('click', () => this.player.playNext());

    // Shuffle & Repeat
    const npShuffle = document.getElementById('np-shuffle-btn');
    if (npShuffle) npShuffle.addEventListener('click', () => this.player.toggleShuffle());

    const npRepeat = document.getElementById('np-repeat-btn');
    if (npRepeat) npRepeat.addEventListener('click', () => this.player.cycleRepeat());

    // Favorite toggle in Now Playing
    const npFav = document.getElementById('np-fav-btn');
    if (npFav) {
      npFav.addEventListener('click', () => {
        if (this.player.currentTrack) {
          const isFav = this.library.toggleFavorite(this.player.currentTrack.id);
          this.player.updateFavoriteUI(isFav);
        }
      });
    }

    // Interactive Scrubber seeking
    const scrubberContainer = document.getElementById('np-scrubber-container');
    if (scrubberContainer) {
      const handleSeek = (e) => {
        const rect = scrubberContainer.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percentage = clickX / rect.width;
        const targetSec = percentage * Math.max(1, this.player.duration);
        this.player.seekTo(targetSec);
      };

      scrubberContainer.addEventListener('click', handleSeek);
    }
  }

  // Equalizer & Audio Settings Binding
  bindEqualizerControls() {
    // Master EQ toggle switch
    const eqToggle = document.getElementById('eq-master-toggle');
    if (eqToggle) {
      eqToggle.addEventListener('click', () => {
        const knob = eqToggle.querySelector('span');
        const isEnabled = knob.classList.contains('translate-x-5');
        if (isEnabled) {
          knob.classList.remove('translate-x-5');
          knob.classList.add('translate-x-0');
          eqToggle.classList.remove('bg-primary-container');
          eqToggle.classList.add('bg-surface-container-highest');
          this.audioEngine.toggleEq(false);
        } else {
          knob.classList.add('translate-x-5');
          knob.classList.remove('translate-x-0');
          eqToggle.classList.add('bg-primary-container');
          eqToggle.classList.remove('bg-surface-container-highest');
          this.audioEngine.toggleEq(true);
        }
      });
    }

    // EQ Presets Carousel
    document.querySelectorAll('.eq-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.eq-preset').forEach(b => {
          b.className = 'eq-preset flex-shrink-0 px-space-sm py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-all';
        });
        btn.className = 'eq-preset active flex-shrink-0 px-space-sm py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold transition-all shadow-sm';
        
        const presetName = btn.textContent.trim();
        this.audioEngine.applyPreset(presetName);
        this.renderEqSliders();
      });
    });

    // Interactive vertical sliders
    const sliderTracks = document.querySelectorAll('.eq-slider-track');
    sliderTracks.forEach((track, index) => {
      const updateSlider = (clientY) => {
        const rect = track.getBoundingClientRect();
        const offsetY = Math.max(0, Math.min(rect.bottom - clientY, rect.height));
        const percentage = offsetY / rect.height; // 0..1
        // Map 0..1 to -10dB .. +10dB
        const gainDb = Math.round((percentage * 20) - 10);
        this.audioEngine.setBandGain(index, gainDb);
        this.renderEqSliders();
      };

      track.addEventListener('mousedown', (e) => {
        updateSlider(e.clientY);
        const onMouseMove = (ev) => updateSlider(ev.clientY);
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      track.addEventListener('touchstart', (e) => {
        if (e.touches[0]) updateSlider(e.touches[0].clientY);
        const onTouchMove = (ev) => {
          if (ev.touches[0]) updateSlider(ev.touches[0].clientY);
        };
        const onTouchEnd = () => {
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onTouchEnd);
        };
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
      }, { passive: true });
    });

    // Reset EQ
    const resetBtn = document.getElementById('reset-eq-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.audioEngine.applyPreset('Flat (Studio)');
        this.renderEqSliders();
      });
    }

    // Clear Cache Button
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => {
        clearCacheBtn.textContent = 'Cleared (0 MB)';
        setTimeout(() => clearCacheBtn.textContent = 'Clear Cache', 2500);
      });
    }

    this.renderEqSliders();
  }

  renderEqSliders() {
    this.audioEngine.bandGains.forEach((gain, i) => {
      const valEl = document.getElementById(`eq-val-${i}`);
      const fillEl = document.getElementById(`eq-fill-${i}`);
      const thumbEl = document.getElementById(`eq-thumb-${i}`);

      const percent = Math.min(100, Math.max(0, ((gain + 10) / 20) * 100));
      if (valEl) {
        valEl.textContent = (gain >= 0 ? `+${gain}` : `${gain}`) + 'dB';
        valEl.className = `font-label-sm text-label-sm font-bold ${gain > 0 ? 'text-primary-container' : gain < 0 ? 'text-on-surface-variant' : 'text-on-surface'}`;
      }
      if (fillEl) fillEl.style.height = `${percent}%`;
      if (thumbEl) thumbEl.style.bottom = `${percent}%`;
    });

    // Update dynamic SVG frequency curve path
    const curvePath = document.getElementById('eq-curve-path');
    const glowPath = document.getElementById('eq-glow-path');
    if (curvePath) {
      const d = this.audioEngine.getSvgCurvePath();
      curvePath.setAttribute('d', d);
      if (glowPath) glowPath.setAttribute('d', d + ' L 300,50 L 0,50 Z');
    }
  }

  // Library Controls Binding
  bindLibraryControls() {
    // Device scan button
    const scanBtn = document.getElementById('scan-device-btn');
    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        scanBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Scanning...';
        if (this.audioEngine.isNative && this.audioEngine.nativeBridge) {
          this.audioEngine.nativeBridge.scanDeviceAudio();
        } else {
          // Trigger local file picker in browser
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'audio/*';
          input.multiple = true;
          input.onchange = (e) => {
            const files = Array.from(e.target.files);
            const scanned = files.map((f, i) => ({
              id: 'local_file_' + i,
              title: f.name.replace(/\.[^/.]+$/, ""),
              artist: 'Local Device File',
              album: 'Local Storage',
              duration: 180,
              uri: URL.createObjectURL(f),
              filePath: f.name,
              coverArt: 'assets/covers/default_cover.png',
              hires: true
            }));
            this.library.addScannedTracks(scanned);
            this.renderLibrary();
            scanBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span> Scan Complete';
            setTimeout(() => {
              scanBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">folder_open</span> Scan Device Music';
            }, 3000);
          };
          input.click();
        }
      });
    }

    // View mode toggle: List vs Grid
    const listBtn = document.getElementById('viewListBtn');
    const gridBtn = document.getElementById('viewGridBtn');
    const plContainer = document.getElementById('playlistContainer');

    if (listBtn && gridBtn && plContainer) {
      listBtn.addEventListener('click', () => {
        listBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-primary-fixed bg-surface-container-highest transition-all';
        gridBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all';
        plContainer.className = 'flex flex-col gap-space-xs transition-all duration-200';
      });

      gridBtn.addEventListener('click', () => {
        gridBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-primary-fixed bg-surface-container-highest transition-all';
        listBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all';
        plContainer.className = 'grid grid-cols-2 gap-space-sm transition-all duration-200';
      });
    }
  }

  // Explore Controls Binding
  bindExploreControls() {
    const searchInput = document.getElementById('explore-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        const results = this.library.search(query);
        this.renderExploreResults(results);
      });
    }

    // Quick filter tags
    document.querySelectorAll('.explore-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        document.querySelectorAll('.explore-tag').forEach(t => {
          t.className = 'explore-tag flex-shrink-0 px-space-md py-space-xs rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-all active:scale-95';
        });
        tag.className = 'explore-tag flex-shrink-0 px-space-md py-space-xs rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold transition-all active:scale-95 shadow-sm';
        const q = tag.textContent.trim();
        const results = this.library.search(q);
        this.renderExploreResults(results);
      });
    });
  }

  bindLyricsControls() {
    if (this.lyricsManager) {
      this.lyricsManager.init({
        heroLine: document.getElementById('lyrics-hero-line'),
        heroTranslation: document.getElementById('lyrics-hero-translation'),
        paceMeter: document.getElementById('lyrics-pace-meter'),
        previousContainer: document.getElementById('lyrics-prev-container'),
        upcomingContainer: document.getElementById('lyrics-upcoming-container')
      });
    }

    // Lyrics bottom transport play/pause
    const lyricsPlay = document.getElementById('lyrics-play-btn');
    if (lyricsPlay) lyricsPlay.addEventListener('click', () => this.player.togglePlayPause());

    const lyricsPrev = document.getElementById('lyrics-prev-btn');
    if (lyricsPrev) lyricsPrev.addEventListener('click', () => this.player.playPrevious());

    const lyricsNext = document.getElementById('lyrics-next-btn');
    if (lyricsNext) lyricsNext.addEventListener('click', () => this.player.playNext());
  }

  // Render Screens Content
  renderHome() {
    const playlistsStack = document.getElementById('home-playlists-stack');
    if (playlistsStack) {
      const plList = this.library.getPlaylists();
      playlistsStack.innerHTML = plList.map((pl, idx) => `
        <div class="group flex items-center justify-between p-space-sm rounded-DEFAULT bg-surface-container/60 hover:bg-surface-container-high/80 transition-all duration-200 cursor-pointer" onclick="window.wavenApp.openPlaylistDetails('${pl.id}')">
          <div class="flex items-center gap-space-sm min-w-0">
            <div class="w-14 h-14 rounded-DEFAULT overflow-hidden shrink-0 relative shadow-sm">
              <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="${pl.coverArt}" alt="${pl.title}">
            </div>
            <div class="flex flex-col min-w-0 pr-space-xs">
              <h5 class="font-label-lg text-label-lg text-primary font-semibold truncate group-hover:text-primary-container transition-colors">${pl.title}</h5>
              <span class="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">By <span class="text-on-surface font-medium">${pl.curator}</span> • ${pl.trackCount} Songs</span>
            </div>
          </div>
          <button class="w-10 h-10 rounded-full bg-surface-container-highest/60 group-hover:bg-primary-container group-hover:text-on-primary-container text-on-surface flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-sm" onclick="event.stopPropagation(); window.wavenApp.playPlaylist('${pl.id}')">
            <span class="material-symbols-outlined text-[20px] ml-0.5" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
          </button>
        </div>
      `).join('');
    }
  }

  renderLibrary() {
    const container = document.getElementById('playlistContainer');
    if (!container) return;

    const tracks = this.library.getAllTracks();
    const countBadge = document.getElementById('library-track-count');
    if (countBadge) countBadge.textContent = `${tracks.length} tracks • Ready for playback`;

    container.innerHTML = tracks.map(t => `
      <div class="playlist-row group flex items-center justify-between p-space-sm rounded-DEFAULT bg-surface-container/60 hover:bg-surface-container active:scale-[0.99] transition-all cursor-pointer" onclick="window.wavenApp.playSpecificTrack('${t.id}')">
        <div class="flex items-center gap-space-sm min-w-0">
          <div class="relative w-14 h-14 rounded-DEFAULT overflow-hidden flex-shrink-0 shadow-md">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="${t.coverArt}" alt="${t.title}">
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-space-xs">
              <span class="font-headline-md text-[16px] leading-[22px] text-primary font-semibold truncate">${t.title}</span>
              ${t.hires ? '<span class="material-symbols-outlined text-primary-fixed text-[15px] flex-shrink-0" style="font-variation-settings: \'FILL\' 1;" title="Lossless Hi-Res">verified</span>' : ''}
            </div>
            <div class="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm truncate">
              <span class="text-secondary font-medium">${t.artist}</span>
              <span class="w-1 h-1 rounded-full bg-outline"></span>
              <span>${this.player.formatTime(t.duration)}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-space-xs">
          <button class="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface hover:text-primary-fixed transition-colors">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  renderExplore() {
    const results = this.library.getAllTracks();
    this.renderExploreResults(results);
  }

  renderExploreResults(tracks) {
    const stack = document.getElementById('explore-tracks-stack');
    if (!stack) return;

    stack.innerHTML = tracks.slice(0, 10).map((t, i) => `
      <div class="group flex items-center justify-between p-space-sm rounded-DEFAULT bg-surface-container hover:bg-surface-container-high transition-colors active:scale-[0.99] cursor-pointer" onclick="window.wavenApp.playSpecificTrack('${t.id}')">
        <div class="flex items-center gap-space-md min-w-0">
          <span class="text-headline-md font-headline-md text-primary-container font-bold w-8 text-center flex-shrink-0 tracking-tight">${(i + 1).toString().padStart(2, '0')}</span>
          <div class="w-12 h-12 rounded-DEFAULT bg-surface-container-highest overflow-hidden flex-shrink-0 relative">
            <img class="w-full h-full object-cover" src="${t.coverArt}" alt="${t.title}">
          </div>
          <div class="flex flex-col min-w-0 pr-space-xs">
            <span class="text-label-lg font-label-lg text-primary truncate font-semibold">${t.title}</span>
            <span class="text-body-sm font-body-sm text-on-surface-variant truncate">${t.artist} • ${t.genre || 'Electronic'}</span>
          </div>
        </div>
        <div class="flex items-center gap-space-sm flex-shrink-0">
          <button class="w-9 h-9 rounded-full bg-surface-container-highest group-hover:bg-primary-container group-hover:text-on-primary-container text-on-surface flex items-center justify-center transition-colors">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  playSpecificTrack(trackId) {
    const tracks = this.library.getAllTracks();
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx >= 0) {
      this.player.setQueue(tracks, idx);
      this.openNowPlaying();
    }
  }

  playPlaylist(playlistId) {
    const tracks = this.library.getAllTracks();
    this.player.setQueue(tracks, 0);
    this.openNowPlaying();
  }

  seekTo(seconds) {
    this.player.seekTo(seconds);
  }

  toggleFavorite(trackId) {
    const isFav = this.library.toggleFavorite(trackId);
    this.player.updateFavoriteUI(isFav);
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.wavenApp = new WavenApp();
});

// Native Android Callbacks
window.onNativeBridgeReady = function() {
  console.log('WAVEN Native Android Bridge initialized successfully.');
  if (window.AndroidBridge && window.AndroidBridge.scanDeviceAudio) {
    window.AndroidBridge.scanDeviceAudio();
  }
};

window.onDeviceAudioScanned = function(tracksJsonStr) {
  if (window.wavenLibrary) {
    window.wavenLibrary.addScannedTracks(tracksJsonStr);
    if (window.wavenApp) window.wavenApp.renderLibrary();
  }
};

window.onTrackPrepared = function(durationMs) {
  if (window.wavenPlayer) {
    window.wavenPlayer.duration = durationMs / 1000;
    window.wavenPlayer.updateProgressUI();
  }
};

window.onNativeStateChanged = function(isPlaying, positionMs, durationMs) {
  if (window.wavenPlayer) {
    window.wavenPlayer.isPlaying = isPlaying;
    window.wavenPlayer.currentTime = positionMs / 1000;
    if (durationMs > 0) window.wavenPlayer.duration = durationMs / 1000;
    window.wavenPlayer.updatePlayPauseUI(isPlaying);
    window.wavenPlayer.updateProgressUI();
  }
};

window.onTrackEnded = function() {
  if (window.wavenPlayer) {
    window.wavenPlayer.handleTrackEnded();
  }
};
