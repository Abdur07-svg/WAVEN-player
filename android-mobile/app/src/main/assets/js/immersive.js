/**
 * WAVEN — IMMERSIVE LISTENING MODE & WEB AUDIO API VISUALIZER
 * Fullscreen ambient listening experience with genuine Web Audio API
 * real-time frequency spectrum visualizer, artwork backdrop, and synced controls.
 */

class ImmersiveModeManager {
  constructor() {
    this.isActive = false;
    this.animFrameId = null;
    this.frequencyData = new Uint8Array(64);
    this.showLyrics = false;

    this.init();
  }

  init() {
    // Listen to player state events
    window.addEventListener("ar7:player_track_loaded", (e) => {
      if (this.isActive) {
        this.updateMetadata(e.detail);
      }
    });

    window.addEventListener("ar7:player_state_changed", (e) => {
      if (this.isActive && e.detail) {
        this.updatePlayState(e.detail.isPlaying);
      }
    });

    window.addEventListener("ar7:player_time_updated", (e) => {
      if (this.isActive && e.detail) {
        this.updateProgress(e.detail.currentTime, e.detail.duration);
      }
    });

    // Keyboard shortcut: 'I' for Immersive, 'Escape' to exit
    window.addEventListener("keydown", (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if ((e.key === "i" || e.key === "I") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.toggle();
      } else if (e.key === "Escape" && this.isActive) {
        e.preventDefault();
        this.close();
      }
    });

    this._bindSeekTrack();
  }

  open() {
    const overlay = document.getElementById("immersive-player-overlay");
    if (!overlay) return;

    this.isActive = true;
    overlay.classList.add("active");

    const track = window.player?.state?.currentTrack;
    this.updateMetadata(track);
    this.updatePlayState(window.player?.state?.isPlaying || false);

    this.startVisualizer();

    if (window.lyricsManager) {
      window.lyricsManager.render();
    }
  }

  close() {
    const overlay = document.getElementById("immersive-player-overlay");
    if (!overlay) return;

    this.isActive = false;
    overlay.classList.remove("active");
    this.stopVisualizer();
  }

  toggle() {
    if (this.isActive) {
      this.close();
    } else {
      this.open();
    }
  }

  toggleLyricsView() {
    this.showLyrics = !this.showLyrics;
    const body = document.getElementById("immersive-center-content");
    if (body) {
      body.classList.toggle("show-lyrics", this.showLyrics);
    }
    const btn = document.getElementById("immersive-lyrics-toggle-btn");
    if (btn) {
      btn.classList.toggle("active", this.showLyrics);
    }
    if (this.showLyrics && window.lyricsManager) {
      window.lyricsManager.render();
      setTimeout(() => window.lyricsManager.updateActiveLineDOM(), 100);
    }
  }

  updateMetadata(track) {
    if (!track) return;

    const bgLayer = document.getElementById("immersive-ambient-bg");
    const artImg = document.getElementById("immersive-artwork-img");
    const titleEl = document.getElementById("immersive-track-title");
    const artistEl = document.getElementById("immersive-track-artist");
    const albumEl = document.getElementById("immersive-track-album");
    const formatEl = document.getElementById("immersive-track-format");

    const art = window.getTrackArtwork ? window.getTrackArtwork(track) : (track.artwork || "assets/covers/default_cover.svg");
    const pal = (window.MetadataParser && window.MetadataParser.getPaletteForTrack)
      ? window.MetadataParser.getPaletteForTrack(track.title, track.artist)
      : { c1: "#3b82f6", c2: "#8b5cf6", glow: "#60a5fa" };
    this.currentPalette = pal;

    if (bgLayer) {
      bgLayer.style.transition = "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
      bgLayer.style.backgroundImage = `url('${art}')`;
      bgLayer.style.backgroundColor = "#07090e";
    }
    const overlay = document.getElementById("immersive-player-overlay");
    if (overlay) {
      overlay.style.transition = "background-image 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
      overlay.style.backgroundColor = "#07090e";
      overlay.style.backgroundImage = `radial-gradient(ellipse 120% 85% at 50% 28%, ${pal.c1}45 0%, ${pal.c2}22 50%, #07090e 90%)`;
      overlay.style.setProperty("--immersive-accent", pal.c1);
      overlay.style.setProperty("--immersive-glow", pal.glow);
    }
    const glassLayer = document.querySelector(".immersive-glass-layer");
    if (glassLayer) {
      glassLayer.style.background = "transparent";
      glassLayer.style.border = "none";
    }
    const badgeDot = document.querySelector(".immersive-badge-dot");
    if (badgeDot) {
      badgeDot.style.backgroundColor = pal.c1;
      badgeDot.style.boxShadow = `0 0 12px ${pal.c1}`;
    }
    if (artImg) {
      artImg.src = art;
      artImg.dataset.title = track.title || "";
      artImg.dataset.artist = track.artist || "";
      artImg.onerror = () => {
        if (window.handleTrackImgError) {
          window.handleTrackImgError(artImg, track.title, track.artist);
        } else {
          artImg.src = "assets/covers/default_cover.svg";
        }
      };
    }
    if (titleEl) titleEl.textContent = track.title || "Unknown Title";
    if (artistEl) artistEl.textContent = track.artist || "Local Audio";
    if (albumEl) albumEl.textContent = track.album || "Local Library";
    if (formatEl) formatEl.textContent = (track.fileType || track.format || "LOCAL").toUpperCase();

    // Update heart in immersive mode
    const heartBtn = document.getElementById("immersive-heart-btn");
    if (heartBtn && window.storageService) {
      const isLiked = window.storageService.isLiked(track.id);
      heartBtn.classList.toggle("active", isLiked);
      const svg = heartBtn.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", isLiked ? "#ef4444" : "none");
        svg.setAttribute("stroke", isLiked ? "#ef4444" : "currentColor");
      }
    }
  }

  updatePlayState(isPlaying) {
    const playBtn = document.getElementById("immersive-play-toggle-btn");
    if (!playBtn) return;

    if (isPlaying) {
      playBtn.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1.5"></rect>
          <rect x="14" y="4" width="4" height="16" rx="1.5"></rect>
        </svg>
      `;
      playBtn.setAttribute("title", "Pause (Space)");
    } else {
      playBtn.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 3px;">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      `;
      playBtn.setAttribute("title", "Play (Space)");
    }
  }

  updateProgress(currentTime, duration) {
    const fill = document.getElementById("immersive-seek-fill");
    const thumb = document.getElementById("immersive-seek-thumb");
    const curTimeEl = document.getElementById("immersive-time-current");
    const durTimeEl = document.getElementById("immersive-time-duration");

    const validDur = (duration && isFinite(duration) && duration > 0) ? duration : 0;
    const pct = validDur > 0 ? (currentTime / validDur) * 100 : 0;

    if (fill) fill.style.width = `${pct}%`;
    if (thumb) thumb.style.left = `${pct}%`;
    if (curTimeEl && window.player) curTimeEl.textContent = window.player.formatTime(currentTime);
    if (durTimeEl && window.player) durTimeEl.textContent = window.player.formatTime(validDur);
  }

  handleSeekClick(event) {
    const trackBar = event.currentTarget || event.target.closest('.immersive-seek-track');
    if (!trackBar || !window.player) return;
    const rect = trackBar.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]);
    let clientX = null;
    if (touch && typeof touch.clientX === "number") {
      clientX = touch.clientX;
    } else if (typeof event.clientX === "number" && !isNaN(event.clientX)) {
      clientX = event.clientX;
    }
    if (clientX === null) return;
    const clickX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));

    window.player.seekByPercentage(pct);
  }

  _bindSeekTrack() {
    const trackBar = document.querySelector(".immersive-seek-track");
    if (!trackBar) return;

    let isSeeking = false;
    let lastFraction = 0;
    let lastTouchTime = 0;

    const getFraction = (e) => {
      const rect = trackBar.getBoundingClientRect();
      if (!rect || rect.width <= 0) return null;
      const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      let clientX = null;
      if (touch && typeof touch.clientX === "number") {
        clientX = touch.clientX;
      } else if (typeof e.clientX === "number" && !isNaN(e.clientX)) {
        clientX = e.clientX;
      }
      if (clientX === null) return null;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const updateSeekVisuals = (pct) => {
      const fill = document.getElementById("immersive-seek-fill");
      const thumb = document.getElementById("immersive-seek-thumb");
      const curTimeEl = document.getElementById("immersive-time-current");
      if (fill) fill.style.width = `${pct * 100}%`;
      if (thumb) thumb.style.left = `${pct * 100}%`;
      if (curTimeEl && window.player) {
        const dur = window.player.state.duration || (window.player.audio && isFinite(window.player.audio.duration) ? window.player.audio.duration : 0);
        curTimeEl.textContent = window.player.formatTime(pct * dur);
      }
    };

    // Unified mouse scrubbing (rejecting synthetic mousedown from touch)
    trackBar.addEventListener("mousedown", (e) => {
      if (Date.now() - lastTouchTime < 800) {
        e.preventDefault();
        return;
      }
      isSeeking = true;
      if (window.player) window.player.startScrubbing();
      const initialF = getFraction(e);
      if (initialF !== null) {
        lastFraction = initialF;
        updateSeekVisuals(initialF);
      }

      const onMouseMove = (moveEv) => {
        if (!isSeeking) return;
        const mf = getFraction(moveEv);
        if (mf !== null) {
          lastFraction = mf;
          updateSeekVisuals(mf);
        }
      };

      const onMouseUp = (upEv) => {
        if (isSeeking) {
          isSeeking = false;
          const endF = getFraction(upEv);
          const target = (endF !== null) ? endF : lastFraction;
          if (window.player && target !== null) {
            window.player.endScrubbing(target);
          }
        }
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    // Touch scrubbing for mobile
    trackBar.addEventListener("touchstart", (e) => {
      lastTouchTime = Date.now();
      isSeeking = true;
      if (window.player) window.player.startScrubbing();
      const f = getFraction(e);
      if (f !== null) {
        lastFraction = f;
        updateSeekVisuals(f);
      }

      const onTouchMove = (moveEv) => {
        lastTouchTime = Date.now();
        if (!isSeeking) return;
        if (moveEv.cancelable) moveEv.preventDefault();
        const mf = getFraction(moveEv);
        if (mf !== null) {
          lastFraction = mf;
          updateSeekVisuals(mf);
        }
      };

      const onTouchEnd = (endEv) => {
        lastTouchTime = Date.now();
        if (endEv.cancelable) endEv.preventDefault();
        if (isSeeking) {
          isSeeking = false;
          const endf = getFraction(endEv);
          const target = (endf !== null) ? endf : lastFraction;
          if (window.player && target !== null) {
            window.player.endScrubbing(target);
          }
        }
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      };

      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd, { passive: false });
      window.addEventListener("touchcancel", onTouchEnd, { passive: false });
    }, { passive: false });
  }

  startVisualizer() {
    this.stopVisualizer();

    const canvas = document.getElementById("immersive-visualizer-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const numBars = 36;
    const barValues = new Float32Array(numBars);
    const targetValues = new Float32Array(numBars);

    const renderFrame = () => {
      if (!this.isActive) return;

      this.animFrameId = requestAnimationFrame(renderFrame);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 70;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const isPlaying = Boolean(window.player && window.player.state && window.player.state.isPlaying);
      const isMuted = Boolean(window.player && window.player.state && window.player.state.isMuted);
      const volume = isMuted ? 0 : (window.player?.state?.volume ?? 0.85);

      if (isPlaying && volume > 0) {
        const curTime = window.player?.audio?.currentTime || 0;
        const track = window.player?.state?.currentTrack;
        const trackTitle = (track?.title || "music").toLowerCase();
        const trackArtist = (typeof track?.artist === 'string' ? track.artist : (track?.artist?.name || '')).toLowerCase();
        const fullMeta = `${trackTitle} ${trackArtist}`;

        // 1. Intelligent Genre & Tempo Profile
        let bpm = 116;
        let energyFactor = 1.0;
        let bassBias = 1.0;

        if (fullMeta.match(/remix|edm|dance|house|club|techno|electro|party|drop|festival/)) {
          bpm = 128;
          energyFactor = 1.25;
          bassBias = 1.35;
        } else if (fullMeta.match(/acoustic|unplugged|piano|slow|sad|lo-?fi|chill|sleep|night|ambient|guitar|calm/)) {
          bpm = 74;
          energyFactor = 0.72;
          bassBias = 0.85;
        } else if (fullMeta.match(/hip-?hop|trap|rap|drill|r&b|soul|groove/)) {
          bpm = 88;
          energyFactor = 1.15;
          bassBias = 1.45;
        } else if (fullMeta.match(/rock|metal|punk|fast|live|drum|band/)) {
          bpm = 142;
          energyFactor = 1.20;
          bassBias = 1.10;
        } else {
          let hash = 0;
          for (let c = 0; c < fullMeta.length; c++) hash = ((hash << 5) - hash + fullMeta.charCodeAt(c)) | 0;
          bpm = 100 + (Math.abs(hash) % 36); // Natural 100 - 135 BPM range
        }

        // 2. Song Intro / Dynamic Section Envelope
        let introRamp = 1.0;
        if (curTime < 6.0) {
          introRamp = 0.45 + (curTime / 6.0) * 0.55;
        }

        // 3. Musical Beat Clocks & Micro-Rhythms
        const beatClock = curTime * (bpm / 60);
        const beatFrac = beatClock - Math.floor(beatClock);
        const eighthFrac = (beatClock * 2) - Math.floor(beatClock * 2);
        const sixteenthFrac = (beatClock * 4) - Math.floor(beatClock * 4);

        const beatNum = Math.floor(beatClock) % 4; // 0 (downbeat), 1 (backbeat), 2 (mid), 3 (pickup)
        const isDownbeat = (beatNum === 0);
        const isBackbeat = (beatNum === 1 || beatNum === 3);

        const kickImpact = isDownbeat ? 1.0 : (beatNum === 2 ? 0.75 : 0.42);
        const kickPulse = Math.pow(Math.max(0, 1 - beatFrac * 2.6), 3.0) * kickImpact;
        const snarePulse = isBackbeat ? Math.pow(Math.max(0, 1 - beatFrac * 2.8), 2.4) : 0.15;
        const eighth = Math.pow(Math.max(0, 1 - eighthFrac * 2.4), 2.0);
        const shimmer = Math.pow(Math.max(0, 1 - sixteenthFrac * 2.2), 1.8);

        // 4. Smooth Continuous Gaussian Multi-Band Envelope
        // Entirely seamless — zero hard boundaries or section dividing
        for (let i = 0; i < numBars; i++) {
          const norm = i / (numBars - 1); // 0.0 to 1.0 continuum

          const wSub = Math.exp(-Math.pow((norm - 0.08) / 0.16, 2));
          const wBass = Math.exp(-Math.pow((norm - 0.22) / 0.18, 2));
          const wLowMid = Math.exp(-Math.pow((norm - 0.44) / 0.20, 2));
          const wHighMid = Math.exp(-Math.pow((norm - 0.68) / 0.20, 2));
          const wAir = Math.exp(-Math.pow((norm - 0.88) / 0.18, 2));

          const waveA = Math.sin(curTime * 6.5 - norm * 5.0) * 0.08;
          const waveB = Math.cos(curTime * 10.2 + norm * 8.0) * 0.06;

          const bandEnergy = (wSub * kickPulse * 0.65 * bassBias) +
                             (wBass * (kickPulse * 0.55 + eighth * 0.18) * bassBias) +
                             (wLowMid * (snarePulse * 0.48 + eighth * 0.15)) +
                             (wHighMid * (snarePulse * 0.38 + shimmer * 0.30)) +
                             (wAir * shimmer * 0.45);

          const ambient = (wSub * 0.10) + (wBass * 0.12) + (wLowMid * 0.14) + (wHighMid * 0.12) + (wAir * 0.10);
          const spectralRoll = 1.0 - norm * 0.25;
          const totalRaw = (bandEnergy + ambient + waveA + waveB) * energyFactor * introRamp * spectralRoll;
          const finalVal = Math.max(6, Math.min(248, totalRaw * volume * 220));

          targetValues[i] = finalVal;

          const speed = targetValues[i] > barValues[i] ? 0.48 : 0.20;
          barValues[i] += (targetValues[i] - barValues[i]) * speed;
        }
      } else {
        // Paused / idle resting state
        for (let i = 0; i < numBars; i++) {
          targetValues[i] = 4;
          barValues[i] += (4 - barValues[i]) * 0.16;
        }
      }

      const totalGap = width * 0.26;
      const barWidth = Math.max(3, (width - totalGap) / numBars);
      const gap = totalGap / (numBars + 1);

      const pal = this.currentPalette || { c1: "#38bdf8", c2: "#c084fc", glow: "#f43f5e" };
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, `${pal.c1}44`);
      gradient.addColorStop(0.5, `${pal.glow || pal.c2}cc`);
      gradient.addColorStop(1, `${pal.c2}f0`);

      ctx.fillStyle = gradient;

      for (let i = 0; i < numBars; i++) {
        const val = barValues[i] || 4;
        const barHeight = Math.max(4, (val / 255) * height * 0.92);

        const x = gap + i * (barWidth + gap);
        const y = height - barHeight;

        // Draw rounded pill bar
        const radius = Math.min(barWidth / 2, 4);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, height);
        ctx.lineTo(x, height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    renderFrame();
  }

  stopVisualizer() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

window.immersiveManager = new ImmersiveModeManager();

