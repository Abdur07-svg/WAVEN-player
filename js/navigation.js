/**
 * AR7 MUSIC — SPA NAVIGATION & VIEW ROUTER
 * View stack, browser history sync, gestures, and dynamic page mounting.
 */

class NavigationRouter {
  constructor() {
    this.currentView = "home";
    this.currentParam = null;
    this.historyStack = [];
    this.forwardStack = [];

    this._bindHistoryEvents();
    this._bindSwipeBack();
  }

  init() {
    const hash = window.location.hash.replace("#", "") || "home";
    const parts = hash.split("/");
    this.navigateTo(parts[0], parts[1] || null, false);
  }

  _bindHistoryEvents() {
    window.addEventListener("popstate", (e) => {
      const fsPlayer = document.getElementById("fullscreen-player-modal");
      if (fsPlayer && fsPlayer.classList.contains("active")) {
        fsPlayer.classList.remove("active");
        return;
      }

      const queueDrawer = document.getElementById("queue-drawer");
      if (queueDrawer && queueDrawer.classList.contains("active")) {
        queueDrawer.classList.remove("active");
        return;
      }

      if (e.state && e.state.view) {
        this.navigateTo(e.state.view, e.state.param, false);
      } else {
        this.navigateTo("home", null, false);
      }
    });
  }

  _bindSwipeBack() {
    let touchStartX = 0;
    let touchStartY = 0;

    window.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener("touchend", (e) => {
      if (e.changedTouches.length === 1) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = Math.abs(touchEndY - touchStartY);

        if (touchStartX < 35 && deltaX > 80 && deltaY < 50) {
          this.goBack();
        }
      }
    }, { passive: true });
  }

  navigateTo(viewName, param = null, pushState = true) {
    if (!viewName) viewName = "home";

    if (pushState) {
      this.historyStack.push({ view: this.currentView, param: this.currentParam });
      this.forwardStack = [];
      const urlHash = param ? `#${viewName}/${param}` : `#${viewName}`;
      window.history.pushState({ view: viewName, param }, "", urlHash);
    }

    this.currentView = viewName;
    this.currentParam = param;

    this._updateActiveViewDOM(viewName, param);
    this._updateNavHighlight(viewName);
    this._updateHistoryButtons();

    const scrollContainer = document.querySelector(".content-scroll-view");
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }

  goBack() {
    const fsPlayer = document.getElementById("fullscreen-player-modal");
    if (fsPlayer && fsPlayer.classList.contains("active")) {
      fsPlayer.classList.remove("active");
      return;
    }

    const queueDrawer = document.getElementById("queue-drawer");
    if (queueDrawer && queueDrawer.classList.contains("active")) {
      queueDrawer.classList.remove("active");
      return;
    }

    if (window.history.length > 1 && this.historyStack.length > 0) {
      window.history.back();
    } else {
      this.navigateTo("home", null, true);
    }
  }

  goForward() {
    window.history.forward();
  }

  _updateActiveViewDOM(viewName, param) {
    document.querySelectorAll(".view").forEach(v => {
      v.classList.remove("active-view");
    });

    let targetViewId = `${viewName}-view`;
    let targetEl = document.getElementById(targetViewId);

    if (viewName === "albums") {
      targetEl = document.getElementById("library-view");
      if (window.libraryManager) {
        window.libraryManager.renderAlbumsView();
      }
    } else if (viewName === "artists") {
      targetEl = document.getElementById("library-view");
      if (window.libraryManager) {
        window.libraryManager.renderArtistsView();
      }
    } else if (viewName === "artist") {
      targetEl = document.getElementById("artist-view");
      if (window.libraryManager) {
        window.libraryManager.renderArtistDetails(param);
      }
    } else if (viewName === "album") {
      targetEl = document.getElementById("album-view");
      if (window.libraryManager) {
        window.libraryManager.renderAlbumDetails(param);
      }
    } else if (viewName === "playlist") {
      targetEl = document.getElementById("playlist-view");
      if (window.playlistsManager) {
        window.playlistsManager.renderPlaylistDetails(param);
      }
    } else if (viewName === "liked" || viewName === "favorites") {
      targetEl = document.getElementById("liked-view");
      if (window.libraryManager) {
        window.libraryManager.renderLikedSongsView();
      }
    } else if (viewName === "genres") {
      targetEl = document.getElementById("library-view");
      if (window.libraryManager) {
        window.libraryManager.renderGenresView(param);
      }
    } else if (viewName === "history") {
      targetEl = document.getElementById("history-view");
      if (window.historyManager) {
        window.historyManager.renderHistoryView();
      }
    } else if (viewName === "library") {
      targetEl = document.getElementById("library-view");
      if (window.libraryManager) {
        window.libraryManager.renderLibraryView();
      }
    } else if (viewName === "settings") {
      targetEl = document.getElementById("settings-view");
      if (window.app && window.app.renderSettingsView) {
        window.app.renderSettingsView();
      }
    } else if (viewName === "insights") {
      targetEl = document.getElementById("insights-view");
      if (window.musicInsights) {
        window.musicInsights.renderInsightsView();
      }
    } else if (viewName === "home") {
      targetEl = document.getElementById("home-view");
      if (window.app && window.app.loadHomeFeeds) {
        window.app.loadHomeFeeds();
      }
    } else if (viewName === "search") {
      targetEl = document.getElementById("search-view");
      if (window.searchManager && !window.searchManager.currentQuery) {
        window.searchManager.renderSearchLanding();
      }
    } else {
      targetEl = document.getElementById("home-view");
      if (window.app && window.app.loadHomeFeeds) {
        window.app.loadHomeFeeds();
      }
    }

    if (targetEl) {
      targetEl.classList.add("active-view");
    }
  }

  _updateNavHighlight(viewName) {
    const isLibraryFamily = ["library", "albums", "album", "artists", "artist", "genres", "playlist"].includes(viewName);
    const isLikedFamily = ["liked", "favourites"].includes(viewName);

    document.querySelectorAll(".dock-item").forEach(item => {
      const target = item.dataset.view;
      const isMatch = (target === viewName) ||
        (target === "library" && isLibraryFamily) ||
        (target === "liked" && isLikedFamily);
      item.classList.toggle("active", Boolean(isMatch));
    });

    document.querySelectorAll(".capsule-nav-item").forEach(item => {
      const target = item.dataset.view;
      const isMatch = (target === viewName) ||
        (target === "artists" && viewName === "artist") ||
        (target === "albums" && viewName === "album") ||
        (target === "playlist" && viewName === "playlist");
      item.classList.toggle("active", Boolean(isMatch));
    });

    document.querySelectorAll(".sidebar .nav-item").forEach(item => {
      const target = item.dataset.view;
      const isMatch = (target === viewName) ||
        (target === "library" && isLibraryFamily) ||
        (target === "liked" && isLikedFamily);
      item.classList.toggle("active", Boolean(isMatch));
    });

    document.querySelectorAll(".mobile-bottom-nav .mobile-nav-item").forEach(item => {
      const target = item.dataset.view;
      const isMatch = (target === viewName) ||
        (target === "library" && isLibraryFamily) ||
        (target === "liked" && isLikedFamily);
      item.classList.toggle("active", Boolean(isMatch));
    });
  }

  _updateHistoryButtons() {
    const backBtn = document.getElementById("nav-back-btn");
    const fwdBtn = document.getElementById("nav-forward-btn");
    if (backBtn) backBtn.disabled = this.historyStack.length === 0;
    if (fwdBtn) fwdBtn.disabled = this.forwardStack.length === 0;
  }
}

window.navigation = new NavigationRouter();
