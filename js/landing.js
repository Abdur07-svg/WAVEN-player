/**
 * WAVEN — Official Android Music Player Landing Page Controller
 *
 * Centralized APK release config, Dark/Light theme persistence,
 * interactive Music Experience showcase, smart platform context,
 * QR synchronization, scroll reveals, and mobile navigation.
 */

const WAVEN_APK_URL = "https://github.com/Abdur07-svg/WAVEN-player/releases/download/v1.0.3/WAVEN-Music-Player.apk";
const WAVEN_APP_VERSION = "v1.0.3";
const WAVEN_APK_SIZE = "3.69 MB";

const WAVEN_RELEASE_META = Object.freeze({
  apkUrl: WAVEN_APK_URL,
  version: WAVEN_APP_VERSION,
  size: WAVEN_APK_SIZE,
  sizeBytes: 3871227,
  fileName: "WAVEN-Music-Player.apk",
  packageName: "com.waven.musicplayer",
  minAndroid: "Android 7.0+"
});

const EXPERIENCE_SCENES = Object.freeze({
  nowPlaying: {
    heading: "Immersive Listening in full focus.",
    body: "Built around distraction-free playback with ambient artwork glow, live audio wave indicators, synchronized LRC lyrics access, and crisp one-handed transport controls.",
    meta: [
      ["View Mode", "Immersive Listening & Now Playing"],
      ["Audio Support", "Local MP3, FLAC, WAV, M4A, AAC, OGG, OPUS"],
      ["Extras", "Live visualizer bars & synchronized lyrics"]
    ]
  },
  lockscreen: {
    heading: "Controls straight from your lock screen.",
    body: "Continue listening with your screen locked via Android's foreground playback service. Play, pause, scrub track progress, and skip songs directly from the lock screen notification or Bluetooth headphones.",
    meta: [
      ["Background Engine", "Foreground Android Media Service"],
      ["Lock Screen UI", "Album artwork, seek bar & transport actions"],
      ["Bluetooth & Keys", "Supports wireless buttons & auto-pause safety"]
    ]
  }
});

(function (global) {
  "use strict";

  const THEME_KEY = "waven_landing_theme";

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hasValidApkUrl() {
    return (
      typeof WAVEN_APK_URL === "string" &&
      WAVEN_APK_URL.startsWith("https://") &&
      !WAVEN_APK_URL.includes("YOUR_ACTUAL_APK_URL")
    );
  }

  function detectPlatform() {
    const nav = global.navigator || {};
    const ua = String(nav.userAgent || "");
    const navPlatform = String(nav.platform || "");
    const maxTouchPoints = Number(nav.maxTouchPoints || 0);
    const uaDataPlatform = String(nav.userAgentData?.platform || "");

    const isExplicitIOS =
      /iPhone|iPad|iPod/i.test(ua) && !global.MSStream && !/Android/i.test(ua);
    const isIPadOSDesktopUA =
      !/Android|Windows|Linux/i.test(ua) &&
      ((/Macintosh/i.test(ua) || navPlatform === "MacIntel") && maxTouchPoints > 1);
    const isUaIOS = !ua && /iOS/i.test(uaDataPlatform);

    if (isExplicitIOS || isIPadOSDesktopUA || isUaIOS) {
      const label = /iPad/i.test(ua) || isIPadOSDesktopUA
        ? "iPad"
        : (/iPod/i.test(ua) ? "iPod" : "iPhone");
      return { platform: "ios", detail: label };
    }

    const isAndroid =
      (/Android/i.test(ua) && !/Windows Phone|IEMobile|iPhone|iPad|iPod/i.test(ua)) ||
      (!ua && /Android/i.test(uaDataPlatform));

    if (isAndroid) {
      return { platform: "android", detail: "Android" };
    }

    const isWindows =
      /Windows NT|Win64|Win32|WOW64/i.test(ua) && !/Windows Phone|IEMobile|Mobile/i.test(ua);
    const isMacOS =
      /Macintosh|Mac OS X/i.test(ua) && !isIPadOSDesktopUA && !/Mobile/i.test(ua);
    const isLinux =
      /Linux/i.test(ua) &&
      !/Android|Mobile|Phone/i.test(ua) &&
      (/X11|x86_64|i686|aarch64|Wayland/i.test(ua) || /Linux/i.test(uaDataPlatform));
    const isChromeOS = /CrOS/i.test(ua);

    if (isWindows) return { platform: "desktop", detail: "Windows" };
    if (isMacOS) return { platform: "desktop", detail: "macOS" };
    if (isLinux) return { platform: "desktop", detail: "Linux" };
    if (isChromeOS) return { platform: "desktop", detail: "ChromeOS" };

    return { platform: "unknown", detail: "Unknown Device" };
  }

  class WavenLandingApp {
    constructor() {
      this.platform = detectPlatform();
    }

    init() {
      this.initTheme();
      this.bindNavigation();
      this.bindExperienceTabs();
      this.bindFeatureFaq();
      this.renderDownloadSection();
      this.initScrollReveal();
    }

    getConfig() {
      return WAVEN_RELEASE_META;
    }

    getPlatform() {
      this.platform = detectPlatform();
      return this.platform;
    }

    /* ----------------------------------------------------------
       Theme System (Dark Luxury default + Warm Off-White Light)
       ---------------------------------------------------------- */
    initTheme() {
      let preferred = "dark";
      try {
        const saved = global.localStorage.getItem(THEME_KEY);
        if (saved === "light" || saved === "dark") {
          preferred = saved;
        }
      } catch {}
      this.applyTheme(preferred, false);
    }

    applyTheme(theme, persist = true) {
      const next = theme === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);

      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute("content", next === "light" ? "#f8f7f4" : "#07080c");
      }

      const sunSvg =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
      const moonSvg =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

      document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        btn.setAttribute("aria-pressed", next === "light" ? "true" : "false");
        const iconSlot = btn.querySelector("[data-theme-icon]");
        const labelSlot = btn.querySelector("[data-theme-label]");
        if (iconSlot) iconSlot.innerHTML = next === "light" ? moonSvg : sunSvg;
        if (labelSlot) labelSlot.textContent = next === "light" ? "Dark" : "Light";
      });

      if (persist) {
        try {
          global.localStorage.setItem(THEME_KEY, next);
        } catch {}
      }
    }

    toggleTheme() {
      const current = document.documentElement.getAttribute("data-theme");
      this.applyTheme(current === "light" ? "dark" : "light", true);
    }

    /* ----------------------------------------------------------
       Navigation, Mobile Drawer & Active Scroll Section
       ---------------------------------------------------------- */
    bindNavigation() {
      const menuBtn = document.getElementById("hamburger-btn");
      const drawer = document.getElementById("mobile-drawer");

      const closeDrawer = () => {
        if (!menuBtn || !drawer) return;
        drawer.hidden = true;
        menuBtn.setAttribute("aria-expanded", "false");
      };

      if (menuBtn && drawer) {
        menuBtn.addEventListener("click", () => {
          const opening = drawer.hidden;
          drawer.hidden = !opening;
          menuBtn.setAttribute("aria-expanded", opening ? "true" : "false");
        });

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && !drawer.hidden) {
            closeDrawer();
            menuBtn.focus();
          }
        });
      }

      document.querySelectorAll("[data-scroll-target]").forEach((link) => {
        link.addEventListener("click", (e) => {
          const targetId = link.getAttribute("data-scroll-target");
          const targetEl = targetId ? document.getElementById(targetId) : null;
          if (!targetEl) return;

          e.preventDefault();
          closeDrawer();

          const reduced =
            typeof global.matchMedia === "function" &&
            global.matchMedia("(prefers-reduced-motion: reduce)").matches;
          targetEl.scrollIntoView({
            behavior: reduced ? "auto" : "smooth",
            block: "start"
          });
        });
      });

      document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        btn.addEventListener("click", () => this.toggleTheme());
      });

      // Active link highlighting on scroll
      const sections = ["home", "experience", "features", "about", "download"]
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      const navItems = Array.from(document.querySelectorAll(".desktop-nav .nav-item"));

      if (sections.length && navItems.length && "IntersectionObserver" in global) {
        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const activeId = entry.target.id;
              navItems.forEach((item) => {
                const target = item.getAttribute("data-scroll-target");
                item.classList.toggle("is-active", target === activeId);
              });
            }
          },
          { rootMargin: "-35% 0px -55% 0px" }
        );
        sections.forEach((sec) => observer.observe(sec));
      }
    }

    /* ----------------------------------------------------------
       Music Experience Section Interactive Scene Switcher
       ---------------------------------------------------------- */
    bindExperienceTabs() {
      const switcher = document.getElementById("experience-scene-switcher");
      const titleEl = document.getElementById("exp-caption-title");
      const bodyEl = document.getElementById("exp-caption-body");
      const listEl = document.getElementById("exp-caption-meta");
      if (!switcher) return;

      const setScene = (sceneKey) => {
        const data = EXPERIENCE_SCENES[sceneKey];
        if (!data) return;

        switcher.querySelectorAll(".scene-tab-btn").forEach((btn) => {
          const active = btn.getAttribute("data-scene") === sceneKey;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });

        document.querySelectorAll(".scene-pane").forEach((pane) => {
          pane.classList.toggle("is-active", pane.getAttribute("data-scene-pane") === sceneKey);
        });

        if (titleEl) titleEl.textContent = data.heading;
        if (bodyEl) bodyEl.textContent = data.body;
        if (listEl) {
          listEl.innerHTML = data.meta
            .map(
              ([k, v]) =>
                `<li><span class="exp-hl-label">${escapeHtml(k)}</span><span class="exp-hl-val">${escapeHtml(v)}</span></li>`
            )
            .join("");
        }
      };

      switcher.addEventListener("click", (e) => {
        const btn = e.target.closest(".scene-tab-btn");
        if (!btn) return;
        setScene(btn.getAttribute("data-scene"));
      });
    }

    /* ----------------------------------------------------------
       Features Section Interactive FAQ Accordion
       ---------------------------------------------------------- */
    bindFeatureFaq() {
      const faqList = document.getElementById("features-faq-list");
      if (!faqList) return;

      const items = Array.from(faqList.querySelectorAll(".faq-item"));

      const setExpanded = (targetItem, shouldOpen) => {
        const btn = targetItem.querySelector(".faq-trigger");
        const panel = targetItem.querySelector(".faq-panel");
        if (!btn || !panel) return;
        targetItem.classList.toggle("is-open", shouldOpen);
        btn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        panel.hidden = !shouldOpen;
      };

      faqList.addEventListener("click", (e) => {
        const trigger = e.target.closest(".faq-trigger");
        if (!trigger) return;
        const item = trigger.closest(".faq-item");
        if (!item) return;

        const willOpen = trigger.getAttribute("aria-expanded") !== "true";
        items.forEach((other) => {
          if (other !== item) setExpanded(other, false);
        });
        setExpanded(item, willOpen);
      });
    }

    /* ----------------------------------------------------------
       Smart Download Section + Verified APK URL + QR Sync
       ---------------------------------------------------------- */
    renderDownloadSection() {
      const container = document.getElementById("download-platform-grid");
      if (!container) return;

      const info = this.getPlatform();
      const validUrl = hasValidApkUrl();

      const statusBadge =
        info.platform === "android"
          ? '<span class="status-tag status-tag--live">Android Device Detected</span>'
          : info.platform === "ios"
            ? '<span class="status-tag status-tag--planned">iOS Not Compatible</span>'
            : '<span class="status-tag status-tag--live">Available for Android</span>';

      const qrSvgHtml =
        validUrl && global.WavenQrCode
          ? global.WavenQrCode.renderQrSvg(WAVEN_APK_URL, {
              quietZone: 4,
              darkColor: "#0f172a",
              bgColor: "#ffffff",
              ariaLabel: `QR code pointing to ${WAVEN_RELEASE_META.fileName}`
            })
          : "";

      const isDesktop = info.platform === "desktop";
      const isIOS = info.platform === "ios";

      let primaryActionHtml = "";
      if (!validUrl) {
        primaryActionHtml = `
          <div class="feedback-banner feedback-banner--blocked" role="status">
            APK download link placeholder: configure <code>WAVEN_APK_URL</code> in <code>js/landing.js</code> with your verified GitHub Release asset URL.
          </div>
        `;
      } else if (isDesktop) {
        primaryActionHtml = `
          <button
            type="button"
            id="final-download-apk-btn"
            class="btn-hero-primary"
            data-apk-trigger="desktop-qr-prompt"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><path d="M14 14h3v3h-3z"></path><path d="M20 14v7h-7"></path></svg>
            <span>Download WAVEN for Android</span>
          </button>
        `;
      } else if (!isIOS) {
        primaryActionHtml = `
          <a
            id="final-download-apk-btn"
            class="btn-hero-primary"
            href="${escapeHtml(WAVEN_APK_URL)}"
            download="${escapeHtml(WAVEN_RELEASE_META.fileName)}"
            rel="noopener noreferrer"
            data-apk-trigger="primary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Download WAVEN for Android</span>
          </a>
        `;
      }

      const platformGuidanceHtml =
        isIOS
          ? `<p class="platform-surface-copy">Note: WAVEN is packaged as an Android <code>.apk</code> file and cannot be installed on ${escapeHtml(info.detail)}. Scan the QR code below with an Android phone or stay tuned for future platform support.</p>`
          : isDesktop
            ? `<p class="platform-surface-copy">Viewing on ${escapeHtml(info.detail)}. WAVEN APK cannot run directly on desktop — a dedicated desktop version will arrive later. Scan the QR code below with your Android phone to download on mobile.</p>`
            : info.platform === "unknown"
              ? `<p class="platform-surface-copy">Requires ${escapeHtml(WAVEN_RELEASE_META.minAndroid)}. Verify your device supports Android APK installation before opening the downloaded file.</p>`
              : `<p class="platform-surface-copy">Ready for ${escapeHtml(WAVEN_RELEASE_META.minAndroid)}. Tap below to download the signed WAVEN APK release directly from GitHub Releases.</p>`;

      const androidCardHtml = `
        <article class="platform-surface" id="android-download-panel" data-platform="${escapeHtml(info.platform)}">
          <div class="platform-surface-head">
            <h3 class="platform-surface-title">WAVEN for Android</h3>
            ${statusBadge}
          </div>

          <div class="verified-meta-strip" aria-label="Verified release information">
            <span class="meta-chip">Version ${escapeHtml(WAVEN_APP_VERSION)}</span>
            <span class="meta-chip">${escapeHtml(WAVEN_APK_SIZE)}</span>
            <span class="meta-chip">${escapeHtml(WAVEN_RELEASE_META.minAndroid)}</span>
            <span class="meta-chip">Package: ${escapeHtml(WAVEN_RELEASE_META.packageName)}</span>
          </div>

          ${platformGuidanceHtml}

          ${primaryActionHtml ? `<div>${primaryActionHtml}</div>` : ""}

          <p class="feedback-banner" id="download-feedback-banner" role="status" aria-live="polite" hidden></p>

          ${qrSvgHtml ? `
            <div class="qr-block" id="download-qr-wrapper">
              <div class="qr-white-pad" id="download-qr-box">${qrSvgHtml}</div>
              <div class="qr-copy">
                <strong>Scan to download on Android mobile</strong>
                <p>Desktop version is coming later. Point your Android camera here to open the verified ${escapeHtml(WAVEN_APP_VERSION)} APK release directly on mobile.</p>
              </div>
            </div>
          ` : ""}
        </article>
      `;

      const secondaryCardHtml = `
        <article class="platform-surface" id="install-and-desktop-panel">
          ${info.platform !== "ios" ? `
            <div class="install-steps-card" id="install-steps-card">
              <h4>Android Installation Steps</h4>
              <ol>
                <li>Scan the QR code or open the link on your Android phone (${escapeHtml(WAVEN_APP_VERSION)}).</li>
                <li>Open the downloaded <code>${escapeHtml(WAVEN_RELEASE_META.fileName)}</code> file.</li>
                <li>Allow installation from this source if Android prompts for permission.</li>
                <li>Tap <strong>Install</strong> and open WAVEN to enjoy your local library.</li>
              </ol>
              <p class="install-security-caption">
                Only install APK files downloaded from the official WAVEN GitHub Releases source.
              </p>
            </div>
          ` : ""}

          <div class="platform-surface-head">
            <h3 class="platform-surface-title">Desktop &amp; Future Platforms</h3>
            <span class="status-tag status-tag--planned">Planned</span>
          </div>
          <p class="platform-surface-copy">
            Dedicated desktop builds and optional online streaming extensions are planned for future releases. Today, WAVEN is focused purely on local playback for Android.
          </p>
          <button type="button" class="btn-disabled-soon" aria-disabled="true" id="desktop-planned-btn">
            Desktop App Coming Soon
          </button>
          <p class="feedback-banner" id="desktop-planned-feedback" role="status" aria-live="polite" hidden></p>
        </article>
      `;

      container.innerHTML = androidCardHtml + secondaryCardHtml;

      const apkTrigger = document.getElementById("final-download-apk-btn");
      if (apkTrigger) {
        apkTrigger.addEventListener("click", () => {
          const fb = document.getElementById("download-feedback-banner");
          const steps = document.getElementById("install-steps-card");
          const qrWrap = document.getElementById("download-qr-wrapper");

          if (isDesktop) {
            if (fb) {
              fb.textContent = `Download is for Android mobile devices only — Desktop app is coming in a future update. Please scan the QR code below with your Android phone to download ${WAVEN_RELEASE_META.fileName} (${WAVEN_APP_VERSION}, ${WAVEN_APK_SIZE}).`;
              fb.hidden = false;
              fb.classList.remove("feedback-banner--blocked");
              fb.classList.add("feedback-banner--qr-prompt");
            }
            if (qrWrap) {
              qrWrap.classList.add("is-qr-focused");
              qrWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
            return;
          }

          if (fb) {
            fb.textContent = `Starting download of ${WAVEN_RELEASE_META.fileName} (${WAVEN_APP_VERSION}, ${WAVEN_APK_SIZE}) from GitHub Releases.`;
            fb.hidden = false;
            fb.classList.remove("feedback-banner--blocked", "feedback-banner--qr-prompt");
          }
          if (steps) {
            steps.classList.add("is-highlighted");
          }
        });
      }

      const plannedBtn = document.getElementById("desktop-planned-btn");
      if (plannedBtn) {
        plannedBtn.addEventListener("click", () => {
          const fb = document.getElementById("desktop-planned-feedback");
          if (fb) {
            fb.textContent = "Desktop builds are planned for a future update. Only Android APK releases are available today.";
            fb.hidden = false;
          }
        });
      }
    }

    /* ----------------------------------------------------------
       Smooth Section Reveal Animations (Reduced-Motion Safe)
       ---------------------------------------------------------- */
    initScrollReveal() {
      const targets = Array.from(document.querySelectorAll(".reveal-target"));
      if (!targets.length) return;

      const reduced =
        typeof global.matchMedia === "function" &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced || !("IntersectionObserver" in global)) {
        targets.forEach((el) => el.classList.add("is-visible"));
        return;
      }

      const revealObserver = new IntersectionObserver(
        (entries, obs) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              obs.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
      );

      targets.forEach((el) => revealObserver.observe(el));
    }
  }

  const app = new WavenLandingApp();
  global.WAVEN_APK_URL = WAVEN_APK_URL;
  global.WAVEN_APP_VERSION = WAVEN_APP_VERSION;
  global.WAVEN_APK_SIZE = WAVEN_APK_SIZE;
  global.wavenLanding = app;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => app.init());
  } else {
    app.init();
  }
})(window);
