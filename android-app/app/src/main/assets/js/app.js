/**
 * WAVEN — Main Application Coordinator & View Router
 * High-Fidelity Local Music Player Architecture
 */

class WavenApp {
  constructor() {
    this.currentView = 'home';
    this.previousView = 'home';
    this.isNowPlayingOpen = false;
    this.isLyricsOpen = false;
    this.currentLibFilter = 'all'; // 'all' | 'liked' | 'artists' | 'albums'

    this.player = window.wavenPlayer;
    this.library = window.wavenLibrary;
    this.audioEngine = window.wavenAudioEngine;
    this.lyricsManager = window.wavenLyricsManager;

    this.userProfile = this.loadUserProfile();
    this.tempAvatar = this.userProfile.avatar;

    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindPlayerControls();
    this.bindEqualizerControls();
    this.bindLibraryControls();
    this.bindExploreControls();
    this.bindLyricsControls();
    this.bindProfileControls();

    this.applyUserProfile();
    this.renderHome();
    this.renderLibrary();
    this.renderExplore();
    this.updateSettingsUI();

    // Check first-time onboarding
    if (!localStorage.getItem('waven_profile_initialized')) {
      setTimeout(() => this.openProfileModal(), 400);
    }

    // Attempt auto-scan if native bridge is already available
    if (this.audioEngine.isNative && this.audioEngine.nativeBridge) {
      setTimeout(() => this.scanDeviceAudio(), 600);
    }
  }

  // -------------------------------------------------------------
  // User Profile & Onboarding Management (No email/phone required)
  // -------------------------------------------------------------
  loadUserProfile() {
    try {
      const data = localStorage.getItem('waven_user_profile');
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {}
    return {
      name: 'Abdur',
      handle: '@audiophile',
      avatar: 'assets/covers/default_cover.png'
    };
  }

  saveUserProfile(profile) {
    this.userProfile = { ...this.userProfile, ...profile };
    try {
      localStorage.setItem('waven_user_profile', JSON.stringify(this.userProfile));
      localStorage.setItem('waven_profile_initialized', 'true');
    } catch (e) {}
    this.applyUserProfile();
  }

  applyUserProfile() {
    const name = this.userProfile.name || 'Abdur';
    const handle = this.userProfile.handle || '@audiophile';
    const avatar = this.userProfile.avatar || 'assets/covers/default_cover.png';

    // 1. Home Screen
    const homeGreeting = document.getElementById('home-greeting');
    if (homeGreeting) homeGreeting.textContent = `Good day, ${name}`;
    const homeAvatar = document.getElementById('home-profile-avatar');
    if (homeAvatar) homeAvatar.src = avatar;

    // 2. Library Screen Vault
    const vaultName = document.getElementById('vault-user-name');
    if (vaultName) vaultName.textContent = `${name}'s Vault`;
    const vaultAvatar = document.getElementById('vault-user-avatar');
    if (vaultAvatar) vaultAvatar.src = avatar;

    // 3. Settings Hub
    const settingsName = document.getElementById('settings-profile-name');
    if (settingsName) settingsName.textContent = name;
    const settingsHandle = document.getElementById('settings-profile-handle');
    if (settingsHandle) settingsHandle.textContent = `${handle} • Offline Listener`;
    const settingsAvatar = document.getElementById('settings-profile-avatar');
    if (settingsAvatar) settingsAvatar.src = avatar;
  }

  openProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    const nameInput = document.getElementById('profile-name-input');
    const handleInput = document.getElementById('profile-handle-input');
    const avatarPreview = document.getElementById('profile-preview-avatar');

    if (nameInput) nameInput.value = this.userProfile.name || 'Abdur';
    if (handleInput) handleInput.value = this.userProfile.handle || '@audiophile';
    if (avatarPreview) avatarPreview.src = this.userProfile.avatar || 'assets/covers/default_cover.png';
    this.tempAvatar = this.userProfile.avatar;

    modal.classList.remove('hidden');
  }

  closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.add('hidden');
  }

  selectPresetAvatar(avatarUrl) {
    this.tempAvatar = avatarUrl;
    const preview = document.getElementById('profile-preview-avatar');
    if (preview) preview.src = avatarUrl;
  }

  bindProfileControls() {
    const uploadInput = document.getElementById('profile-image-upload');
    if (uploadInput) {
      uploadInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target.result;
            this.tempAvatar = dataUrl;
            const preview = document.getElementById('profile-preview-avatar');
            if (preview) preview.src = dataUrl;
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  saveProfileFromModal() {
    const nameInput = document.getElementById('profile-name-input');
    const handleInput = document.getElementById('profile-handle-input');

    const name = nameInput ? nameInput.value.trim() : 'Abdur';
    const handle = handleInput ? handleInput.value.trim() : '@audiophile';

    this.saveUserProfile({
      name: name || 'Abdur',
      handle: handle.startsWith('@') ? handle : `@${handle}`,
      avatar: this.tempAvatar || 'assets/covers/default_cover.png'
    });

    this.closeProfileModal();
    if (this.audioEngine.isNative && this.audioEngine.nativeBridge) {
      this.audioEngine.nativeBridge.showToast('Profile saved!');
    }
  }

  // -------------------------------------------------------------
  // Online Streaming Explanatory Notice
  // -------------------------------------------------------------
  showStreamingNotice(title) {
    const modal = document.getElementById('streaming-modal');
    const titleEl = document.getElementById('streaming-modal-title');
    if (titleEl && title) titleEl.textContent = title;
    if (modal) modal.classList.remove('hidden');
  }

  closeStreamingNotice() {
    const modal = document.getElementById('streaming-modal');
    if (modal) modal.classList.add('hidden');
  }

  // -------------------------------------------------------------
  // View Navigation
  // -------------------------------------------------------------
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

    // Refresh view specific contents
    if (viewName === 'library') {
      this.renderLibrary();
    } else if (viewName === 'explore') {
      this.renderExplore();
    } else if (viewName === 'settings') {
      this.updateSettingsUI();
    }
  }

  openNowPlaying() {
    this.isNowPlayingOpen = true;
    const modal = document.getElementById('view-now-playing');
    if (modal) {
      modal.classList.add('open');
      modal.style.transform = 'translateY(0)';
      modal.style.pointerEvents = 'auto';
    }
  }

  closeNowPlaying() {
    this.isNowPlayingOpen = false;
    const modal = document.getElementById('view-now-playing');
    if (modal) {
      modal.classList.remove('open');
      modal.style.transform = 'translateY(100%)';
      modal.style.pointerEvents = 'none';
    }
  }

  openLyrics() {
    this.isLyricsOpen = true;
    const modal = document.getElementById('view-lyrics');
    if (modal) {
      modal.classList.add('open');
      modal.style.transform = 'translateY(0)';
      modal.style.pointerEvents = 'auto';
    }
    if (this.lyricsManager) this.lyricsManager.render();
  }

  closeLyrics() {
    this.isLyricsOpen = false;
    const modal = document.getElementById('view-lyrics');
    if (modal) {
      modal.classList.remove('open');
      modal.style.transform = 'translateY(100%)';
      modal.style.pointerEvents = 'none';
    }
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
    const profileModal = document.getElementById('profile-modal');
    if (profileModal && !profileModal.classList.contains('hidden')) {
      this.closeProfileModal();
      return true;
    }
    const streamModal = document.getElementById('streaming-modal');
    if (streamModal && !streamModal.classList.contains('hidden')) {
      this.closeStreamingNotice();
      return true;
    }
    if (this.currentView !== 'home') {
      this.navigateTo('home');
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // Audio Scanning & Storage
  // -------------------------------------------------------------
  scanDeviceAudio() {
    const scanBtnText = document.getElementById('scan-btn-text');
    if (scanBtnText) scanBtnText.textContent = 'Scanning...';

    if (this.audioEngine.isNative && this.audioEngine.nativeBridge) {
      this.audioEngine.nativeBridge.scanDeviceAudio();
    } else {
      // Browser fallback file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.multiple = true;
      input.onchange = (e) => {
        const files = Array.from(e.target.files);
        const scanned = files.map((f, i) => ({
          id: 'local_file_' + i,
          title: f.name.replace(/\.[^/.]+$/, ""),
          artist: 'Local Device Audio',
          album: 'Device Storage',
          duration: 180,
          uri: URL.createObjectURL(f),
          filePath: f.name,
          coverArt: 'assets/covers/default_cover.png',
          hires: true
        }));
        this.library.addScannedTracks(scanned);
        this.renderLibrary();
        this.renderHome();
        this.renderExplore();
        this.updateSettingsUI();
        if (scanBtnText) scanBtnText.textContent = 'Scan Device Music';
      };
      input.click();
    }
  }

  clearLibraryCache() {
    this.library.clearScannedTracks();
    this.renderLibrary();
    this.renderHome();
    this.renderExplore();
    this.updateSettingsUI();
    if (this.audioEngine.isNative && this.audioEngine.nativeBridge) {
      this.audioEngine.nativeBridge.showToast('Audio cache cleared');
    }
  }

  openAppSettings() {
    if (this.audioEngine.isNative && this.audioEngine.nativeBridge && this.audioEngine.nativeBridge.openAppSettings) {
      this.audioEngine.nativeBridge.openAppSettings();
    } else {
      alert('To manage permissions on Android, open: System Settings > Apps > WAVEN > Permissions');
    }
  }

  // -------------------------------------------------------------
  // Library Controls & Filtering
  // -------------------------------------------------------------
  filterLibrary(filterName) {
    this.currentLibFilter = filterName;

    // Update active tab buttons
    const tabs = ['all', 'liked', 'artists', 'albums'];
    tabs.forEach(tab => {
      const btn = document.getElementById(`tab-${tab === 'all' ? 'all-songs' : tab === 'liked' ? 'liked-songs' : tab}`);
      if (btn) {
        if (tab === filterName) {
          btn.className = 'lib-tab px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-md text-xs font-bold transition-all shrink-0 shadow-sm';
        } else {
          btn.className = 'lib-tab px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface-variant font-label-md text-xs font-medium hover:text-white transition-all shrink-0';
        }
      }
    });

    this.renderLibrary();
  }

  playLikedSongs() {
    const liked = this.library.getLikedTracks();
    if (liked.length === 0) {
      if (this.audioEngine.isNative && this.audioEngine.nativeBridge) {
        this.audioEngine.nativeBridge.showToast('No liked songs yet! Tap the heart icon on any song.');
      } else {
        alert('No liked songs yet! Tap the heart icon on any song to add it to Favorites.');
      }
      return;
    }
    this.player.setQueue(liked, 0);
    this.openNowPlaying();
  }

  bindLibraryControls() {
    // Handled in HTML template
  }

  renderLibrary() {
    const container = document.getElementById('playlistContainer');
    if (!container) return;

    const allTracks = this.library.getAllTracks();
    const likedTracks = this.library.getLikedTracks();

    // Update count labels
    const countBadge = document.getElementById('library-track-count');
    if (countBadge) countBadge.textContent = `${allTracks.length} tracks • Ready for playback`;

    const likedBadge = document.getElementById('library-liked-count');
    if (likedBadge) likedBadge.textContent = `${likedTracks.length} songs in favorites`;

    // 1. If filtering by 'liked'
    if (this.currentLibFilter === 'liked') {
      if (likedTracks.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center flex flex-col items-center justify-center rounded-2xl bg-surface-container/40 border border-white/5 my-4">
            <div class="w-14 h-14 rounded-full bg-secondary-container/20 text-secondary-fixed flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[28px]">favorite_border</span>
            </div>
            <h4 class="font-headline-md text-white font-bold text-base">No Liked Songs Yet</h4>
            <p class="text-xs text-on-surface-variant mt-1 max-w-xs">Tap the heart icon on any song while listening to add it to your favorites.</p>
          </div>
        `;
        return;
      }
      this.renderTrackList(container, likedTracks);
      return;
    }

    // 2. If filtering by 'artists'
    if (this.currentLibFilter === 'artists') {
      const artists = this.library.getArtists();
      if (artists.length === 0) {
        this.renderEmptyLibrary(container);
        return;
      }
      container.innerHTML = artists.map(a => `
        <div class="flex items-center justify-between p-space-sm rounded-DEFAULT bg-surface-container/60 hover:bg-surface-container transition-all cursor-pointer" onclick="window.wavenApp.playSpecificTrack('${a.songs[0].id}')">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary-fixed font-bold border border-white/10">
              <span class="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-headline-md text-sm text-primary font-bold truncate">${a.artist}</span>
              <span class="text-xs text-on-surface-variant">${a.count} song${a.count > 1 ? 's' : ''}</span>
            </div>
          </div>
          <span class="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
        </div>
      `).join('');
      return;
    }

    // 3. If filtering by 'albums'
    if (this.currentLibFilter === 'albums') {
      const albums = this.library.getAlbums();
      if (albums.length === 0) {
        this.renderEmptyLibrary(container);
        return;
      }
      container.innerHTML = albums.map(alb => `
        <div class="flex items-center justify-between p-space-sm rounded-DEFAULT bg-surface-container/60 hover:bg-surface-container transition-all cursor-pointer" onclick="window.wavenApp.playSpecificTrack('${alb.songs[0].id}')">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-xl bg-surface-container-high overflow-hidden border border-white/10">
              <img src="${alb.coverArt}" class="w-full h-full object-cover">
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-headline-md text-sm text-primary font-bold truncate">${alb.album}</span>
              <span class="text-xs text-on-surface-variant">${alb.artist || 'Local Audio'} • ${alb.songs.length} song${alb.songs.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <span class="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
        </div>
      `).join('');
      return;
    }

    // 4. Default: 'all'
    if (allTracks.length === 0) {
      this.renderEmptyLibrary(container);
      return;
    }
    this.renderTrackList(container, allTracks);
  }

  renderEmptyLibrary(container) {
    container.innerHTML = `
      <div class="p-8 text-center flex flex-col items-center justify-center rounded-2xl bg-surface-container/40 border border-white/5 my-4">
        <div class="w-16 h-16 rounded-full bg-primary-container/10 text-primary-fixed flex items-center justify-center mb-3">
          <span class="material-symbols-outlined text-[32px]">library_music</span>
        </div>
        <h4 class="font-headline-md text-white font-bold text-base">No Local Songs Found</h4>
        <p class="text-xs text-on-surface-variant mt-1.5 max-w-xs leading-relaxed">
          WAVEN plays music stored on your Android device (.mp3, .flac, .wav, .m4a). Tap the button below to scan your storage.
        </p>
        <button onclick="window.wavenApp.scanDeviceAudio()" class="mt-5 px-5 py-2.5 rounded-full bg-primary-container text-black font-headline font-bold text-xs tracking-wide shadow-lg active:scale-95 transition-transform flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">folder_open</span>
          <span>Scan Device Storage</span>
        </button>
      </div>
    `;
  }

  renderTrackList(container, tracks) {
    container.innerHTML = tracks.map(t => {
      const isFav = this.library.isFavorite(t.id);
      return `
        <div class="playlist-row group flex items-center justify-between p-space-sm rounded-DEFAULT bg-surface-container/60 hover:bg-surface-container active:scale-[0.99] transition-all cursor-pointer" onclick="window.wavenApp.playSpecificTrack('${t.id}')">
          <div class="flex items-center gap-space-sm min-w-0 flex-1">
            <div class="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md bg-surface-container-high border border-white/5">
              <img class="w-full h-full object-cover" src="${t.coverArt}" alt="${t.title}" onerror="this.src='assets/covers/default_cover.png'">
            </div>
            <div class="flex flex-col min-w-0 pr-space-xs">
              <div class="flex items-center gap-space-xs">
                <span class="font-headline-md text-sm text-primary font-semibold truncate">${t.title}</span>
                <span class="material-symbols-outlined text-primary-fixed text-[14px] flex-shrink-0" style="font-variation-settings: 'FILL' 1;" title="Bit-Perfect Local Audio">verified</span>
              </div>
              <div class="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-xs truncate">
                <span class="text-secondary font-medium">${t.artist}</span>
                <span class="w-1 h-1 rounded-full bg-outline"></span>
                <span>${this.player.formatTime(t.duration)}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
            <button class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-secondary-fixed transition-colors active:scale-90" onclick="window.wavenApp.toggleFavorite('${t.id}')" title="Favorite">
              <span class="material-symbols-outlined text-[20px] ${isFav ? 'text-secondary-fixed' : ''}" style="${isFav ? 'font-variation-settings: \'FILL\' 1;' : ''}">favorite</span>
            </button>
            <button class="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface hover:text-primary-fixed transition-colors active:scale-90" onclick="window.wavenApp.playSpecificTrack('${t.id}')">
              <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // Explore Controls & Search
  // -------------------------------------------------------------
  bindExploreControls() {
    const searchInput = document.getElementById('explore-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        const results = this.library.search(query);
        this.renderExploreResults(results);
      });
    }

    const clearBtn = document.getElementById('clearExploreSearch');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          this.renderExploreResults(this.library.getAllTracks());
        }
      });
    }

    // Quick filter chips
    document.querySelectorAll('.explore-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        document.querySelectorAll('.explore-tag').forEach(t => {
          t.className = 'explore-tag flex-shrink-0 px-space-md py-space-xs rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-all active:scale-95';
        });
        tag.className = 'explore-tag flex-shrink-0 px-space-md py-space-xs rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold transition-all active:scale-95 shadow-sm';
        const q = tag.textContent.trim();
        if (q === 'All' || q === 'Local Audio') {
          this.renderExploreResults(this.library.getAllTracks());
        } else if (q === 'Favorites') {
          this.renderExploreResults(this.library.getLikedTracks());
        } else {
          this.renderExploreResults(this.library.search(q));
        }
      });
    });
  }

  renderExplore() {
    this.renderExploreResults(this.library.getAllTracks());
  }

  renderExploreResults(tracks) {
    const stack = document.getElementById('explore-tracks-stack');
    const countLabel = document.getElementById('explore-count-label');
    if (countLabel) countLabel.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
    if (!stack) return;

    if (tracks.length === 0) {
      stack.innerHTML = `
        <div class="p-6 text-center text-xs text-on-surface-variant">
          No matching tracks found on your device.
        </div>
      `;
      return;
    }

    stack.innerHTML = tracks.slice(0, 25).map((t, i) => `
      <div class="group flex items-center justify-between p-space-sm rounded-DEFAULT bg-surface-container hover:bg-surface-container-high transition-colors active:scale-[0.99] cursor-pointer" onclick="window.wavenApp.playSpecificTrack('${t.id}')">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-sm font-bold text-primary-container w-6 text-center shrink-0">${(i + 1).toString().padStart(2, '0')}</span>
          <div class="w-12 h-12 rounded-xl bg-surface-container-highest overflow-hidden shrink-0 border border-white/5">
            <img class="w-full h-full object-cover" src="${t.coverArt}" alt="${t.title}" onerror="this.src='assets/covers/default_cover.png'">
          </div>
          <div class="flex flex-col min-w-0 pr-space-xs">
            <span class="text-sm font-semibold text-primary truncate">${t.title}</span>
            <span class="text-xs text-on-surface-variant truncate">${t.artist} • ${this.player.formatTime(t.duration)}</span>
          </div>
        </div>
        <button class="w-9 h-9 rounded-full bg-surface-container-highest group-hover:bg-primary-container group-hover:text-on-primary-container text-on-surface flex items-center justify-center transition-colors">
          <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
        </button>
      </div>
    `).join('');
  }

  // -------------------------------------------------------------
  // Home Screen Content
  // -------------------------------------------------------------
  renderHome() {
    const tracks = this.library.getAllTracks();
    const badge = document.getElementById('home-local-badge');
    if (badge) badge.textContent = `${tracks.length} Track${tracks.length !== 1 ? 's' : ''}`;

    const desc = document.getElementById('home-storage-desc');
    if (desc) desc.textContent = tracks.length > 0 ? `${tracks.length} songs ready for bit-perfect playback` : 'Tap to scan and play all audio on device';

    const stack = document.getElementById('home-playlists-stack');
    if (stack) {
      if (tracks.length === 0) {
        stack.innerHTML = `
          <div class="p-4 text-center rounded-xl bg-surface-container/50 border border-white/5 text-xs text-on-surface-variant">
            No local audio tracks loaded yet. Tap "Scan" above to load your music.
          </div>
        `;
        return;
      }

      stack.innerHTML = tracks.slice(0, 5).map(t => `
        <div class="group flex items-center justify-between p-space-sm rounded-DEFAULT bg-surface-container/60 hover:bg-surface-container-high transition-all cursor-pointer" onclick="window.wavenApp.playSpecificTrack('${t.id}')">
          <div class="flex items-center gap-space-sm min-w-0">
            <div class="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-surface-container border border-white/5">
              <img class="w-full h-full object-cover" src="${t.coverArt}" alt="${t.title}" onerror="this.src='assets/covers/default_cover.png'">
            </div>
            <div class="flex flex-col min-w-0 pr-space-xs">
              <span class="font-headline-md text-sm text-primary font-semibold truncate group-hover:text-primary-container transition-colors">${t.title}</span>
              <span class="font-body-sm text-xs text-on-surface-variant truncate">${t.artist} • ${this.player.formatTime(t.duration)}</span>
            </div>
          </div>
          <button class="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
          </button>
        </div>
      `).join('');
    }
  }

  // -------------------------------------------------------------
  // Settings UI Updates
  // -------------------------------------------------------------
  updateSettingsUI() {
    const tracks = this.library.getAllTracks();
    const badge = document.getElementById('settings-tracks-badge');
    if (badge) badge.textContent = `${tracks.length} tracks scanned`;
  }

  // -------------------------------------------------------------
  // Player Controls Binding
  // -------------------------------------------------------------
  bindPlayerControls() {
    // Mini player container tap to open full Now Playing screen
    const miniPlayer = document.getElementById('mini-player');
    if (miniPlayer) {
      miniPlayer.addEventListener('click', (e) => {
        if (e.target.closest('#mini-prev-btn, #mini-play-btn, #mini-next-btn')) return;
        this.openNowPlaying();
      });
    }

    // Mini player transport buttons
    const miniPlay = document.getElementById('mini-play-btn');
    if (miniPlay) miniPlay.addEventListener('click', () => this.player.togglePlayPause());

    const miniPrev = document.getElementById('mini-prev-btn');
    if (miniPrev) miniPrev.addEventListener('click', () => this.player.playPrevious());

    const miniNext = document.getElementById('mini-next-btn');
    if (miniNext) miniNext.addEventListener('click', () => this.player.playNext());

    // Full Now Playing Transport buttons
    const npPlay = document.getElementById('np-play-btn');
    if (npPlay) npPlay.addEventListener('click', () => this.player.togglePlayPause());

    const npPrev = document.getElementById('np-prev-btn');
    if (npPrev) npPrev.addEventListener('click', () => this.player.playPrevious());

    const npNext = document.getElementById('np-next-btn');
    if (npNext) npNext.addEventListener('click', () => this.player.playNext());

    const npShuffle = document.getElementById('np-shuffle-btn');
    if (npShuffle) npShuffle.addEventListener('click', () => this.player.toggleShuffle());

    const npRepeat = document.getElementById('np-repeat-btn');
    if (npRepeat) npRepeat.addEventListener('click', () => this.player.toggleRepeat());

    const npFav = document.getElementById('np-fav-btn');
    if (npFav) npFav.addEventListener('click', () => {
      if (this.player.currentTrack) {
        this.toggleFavorite(this.player.currentTrack.id);
      }
    });

    // Scrubber timeline seeking
    const scrubber = document.getElementById('scrubber-track');
    if (scrubber) {
      scrubber.addEventListener('click', (e) => {
        const rect = scrubber.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seekTime = percent * (this.player.duration || 1);
        this.player.seekTo(seekTime);
      });
    }
  }

  bindEqualizerControls() {
    // Preset buttons
    document.querySelectorAll('.eq-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.eq-preset').forEach(b => {
          b.className = 'eq-preset flex-shrink-0 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-xs transition-all';
        });
        btn.className = 'eq-preset active flex-shrink-0 px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-md text-xs font-semibold transition-all';
        const presetName = btn.textContent.trim();
        if (this.audioEngine) this.audioEngine.applyPreset(presetName);
        this.syncEqualizerUI();
      });
    });

    // Touch/click drag for 6-band sliders
    document.querySelectorAll('.eq-slider-track').forEach(track => {
      const handleSlider = (e) => {
        const bandIdx = parseInt(track.getAttribute('data-band'));
        const rect = track.getBoundingClientRect();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const percent = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
        const gain = Math.round((percent * 24) - 12); // -12dB to +12dB

        if (this.audioEngine) this.audioEngine.setBandGain(bandIdx, gain);
        this.syncEqualizerUI();
      };

      track.addEventListener('mousedown', (e) => {
        handleSlider(e);
        const onMouseMove = (ev) => handleSlider(ev);
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      track.addEventListener('touchstart', (e) => {
        handleSlider(e);
        const onTouchMove = (ev) => handleSlider(ev);
        const onTouchEnd = () => {
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onTouchEnd);
        };
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
      });
    });
  }

  syncEqualizerUI() {
    if (!this.audioEngine) return;
    const gains = this.audioEngine.bandGains;
    gains.forEach((gain, i) => {
      const fill = document.getElementById(`eq-fill-${i}`);
      const thumb = document.getElementById(`eq-thumb-${i}`);
      const val = document.getElementById(`eq-val-${i}`);

      const percent = ((gain + 12) / 24) * 100;
      if (fill) fill.style.height = `${percent}%`;
      if (thumb) thumb.style.bottom = `${percent}%`;
      if (val) {
        val.textContent = (gain > 0 ? `+${gain}` : `${gain}`) + 'dB';
      }
    });

    // Dynamic curve
    const curvePath = document.getElementById('eq-curve-path');
    const glowPath = document.getElementById('eq-glow-path');
    if (curvePath && glowPath) {
      const pts = gains.map((g, i) => {
        const x = i * 60;
        const y = 35 - (g * 1.5);
        return `${x},${y}`;
      });
      const d = `M0,${35 - gains[0]*1.5} Q30,${35 - gains[1]*1.5} 60,${35 - gains[1]*1.5} T120,${35 - gains[2]*1.5} T180,${35 - gains[3]*1.5} T240,${35 - gains[4]*1.5} T300,${35 - gains[5]*1.5}`;
      curvePath.setAttribute('d', d);
      glowPath.setAttribute('d', d + ' L 300,50 L 0,50 Z');
    }
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

    const lyricsPlay = document.getElementById('lyrics-play-btn');
    if (lyricsPlay) lyricsPlay.addEventListener('click', () => this.player.togglePlayPause());

    const lyricsPrev = document.getElementById('lyrics-prev-btn');
    if (lyricsPrev) lyricsPrev.addEventListener('click', () => this.player.playPrevious());

    const lyricsNext = document.getElementById('lyrics-next-btn');
    if (lyricsNext) lyricsNext.addEventListener('click', () => this.player.playNext());
  }

  bindNavigation() {
    document.querySelectorAll('#bottom-nav a[data-path]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const path = a.getAttribute('data-path');
        this.navigateTo(path);
      });
    });
  }

  playSpecificTrack(trackId) {
    const tracks = this.library.getAllTracks();
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx >= 0) {
      this.player.setQueue(tracks, idx);
      this.openNowPlaying();
    }
  }

  toggleFavorite(trackId) {
    const isFav = this.library.toggleFavorite(trackId);
    this.player.updateFavoriteUI(isFav);
    this.renderLibrary();
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.wavenApp = new WavenApp();
});

// -------------------------------------------------------------
// Native Android Callbacks
// -------------------------------------------------------------
window.onNativeBridgeReady = function() {
  console.log('WAVEN Native Android Bridge initialized successfully.');
  if (window.wavenApp) {
    window.wavenApp.scanDeviceAudio();
  }
};

window.onDeviceAudioScanned = function(tracksData) {
  if (window.wavenLibrary) {
    window.wavenLibrary.addScannedTracks(tracksData);
    if (window.wavenApp) {
      window.wavenApp.renderLibrary();
      window.wavenApp.renderHome();
      window.wavenApp.renderExplore();
      window.wavenApp.updateSettingsUI();
    }
  }
};

window.onDeviceAudioScanError = function(errMsg) {
  console.warn('Scan error:', errMsg);
  const scanBtnText = document.getElementById('scan-btn-text');
  if (scanBtnText) scanBtnText.textContent = 'Scan Storage';
};

window.onPermissionsGranted = function() {
  console.log('Storage permissions granted by user.');
  if (window.wavenApp) {
    window.wavenApp.scanDeviceAudio();
  }
};

window.onPermissionsDenied = function() {
  console.warn('Storage permission denied.');
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
