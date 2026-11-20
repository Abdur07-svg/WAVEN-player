/**
 * WAVEN — Synchronized Lyrics & Karaoke Engine
 */

class LyricsManager {
  constructor() {
    this.currentLyrics = [];
    this.activeIndex = -1;
    this.container = null;
    this.heroLineEl = null;
    this.heroTranslationEl = null;
    this.paceMeterEl = null;
    this.previousContainerEl = null;
    this.upcomingContainerEl = null;

    // Default synchronized lyrics for featured demo tracks
    this.sampleLyrics = {
      'default': [
        { time: 0, text: "In the quiet of the midnight hour", translation: "Di keheningan waktu tengah malam" },
        { time: 8, text: "Shadows dancing on the bedroom wall", translation: "Bayangan menari di dinding kamar" },
        { time: 16, text: "Whispers echoing through the neon haze", translation: "Gema bisikan menembus kabut neon malam" },
        { time: 24, text: "Every pulse is a beat we cannot hide", translation: "Setiap denyut adalah irama yang tak terbendung" },
        { time: 32, text: "Waiting for the dawn to break the tide", translation: "Menanti fajar meretakkan ombak" },
        { time: 40, text: "Hold the frequency till morning light", translation: "Pegang frekuensi hingga cahaya pagi" },
        { time: 48, text: "Electric echoes never fade away", translation: "Gema listrik takkan pernah padam" },
        { time: 56, text: "We dissolve into the ultraviolet sky", translation: "Kita melarut ke dalam langit ultraviolet" }
      ]
    };
  }

  init(domElements) {
    this.heroLineEl = domElements.heroLine;
    this.heroTranslationEl = domElements.heroTranslation;
    this.paceMeterEl = domElements.paceMeter;
    this.previousContainerEl = domElements.previousContainer;
    this.upcomingContainerEl = domElements.upcomingContainer;
    this.setTrackLyrics('default');
  }

  setTrackLyrics(trackKey) {
    this.currentLyrics = this.sampleLyrics[trackKey] || this.sampleLyrics['default'];
    this.activeIndex = -1;
    this.render();
  }

  update(currentTimeSeconds) {
    if (!this.currentLyrics || this.currentLyrics.length === 0) return;

    let index = -1;
    for (let i = 0; i < this.currentLyrics.length; i++) {
      if (currentTimeSeconds >= this.currentLyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }

    if (index !== this.activeIndex && index >= 0) {
      this.activeIndex = index;
      this.render();
    }

    // Update syllable pace meter
    if (this.activeIndex >= 0 && this.paceMeterEl) {
      const current = this.currentLyrics[this.activeIndex];
      const nextTime = (this.activeIndex < this.currentLyrics.length - 1)
        ? this.currentLyrics[this.activeIndex + 1].time
        : current.time + 8;
      const duration = Math.max(1, nextTime - current.time);
      const progress = Math.min(100, Math.max(0, ((currentTimeSeconds - current.time) / duration) * 100));
      this.paceMeterEl.style.width = `${progress}%`;
    }
  }

  render() {
    if (!this.heroLineEl) return;
    const active = this.currentLyrics[this.activeIndex] || this.currentLyrics[0];
    
    // Format timestamp string
    const formatTime = (sec) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Render active hero line
    const words = active.text.split(' ');
    this.heroLineEl.innerHTML = words.map((w, idx) => {
      const isLead = idx < Math.ceil(words.length / 2);
      return `<span class="font-headline-xl-mobile text-headline-xl-mobile font-bold ${isLead ? 'text-primary-container drop-shadow-[0_0_18px_rgba(204,242,46,0.45)]' : 'text-on-surface'}">${w}</span>`;
    }).join(' ');

    if (this.heroTranslationEl) {
      this.heroTranslationEl.innerHTML = `
        <span class="italic text-secondary">"${active.translation || ''}"</span>
        <span class="font-label-sm text-label-sm text-primary-container font-medium">${formatTime(active.time)}</span>
      `;
    }

    // Previous lines (faded)
    if (this.previousContainerEl) {
      const prevLines = this.currentLyrics.slice(0, Math.max(0, this.activeIndex));
      this.previousContainerEl.innerHTML = prevLines.slice(-2).map(line => `
        <div class="flex items-center justify-between cursor-pointer py-1 hover:opacity-100 transition-opacity" onclick="window.wavenApp.seekTo(${line.time})">
          <p class="font-body-lg text-body-lg text-on-surface">${line.text}</p>
          <span class="font-label-sm text-label-sm text-on-surface-variant">${formatTime(line.time)}</span>
        </div>
      `).join('');
    }

    // Upcoming lines
    if (this.upcomingContainerEl) {
      const upcomingLines = this.currentLyrics.slice(this.activeIndex + 1);
      this.upcomingContainerEl.innerHTML = upcomingLines.slice(0, 5).map((line, idx) => `
        <div class="flex items-center justify-between group py-1 cursor-pointer" onclick="window.wavenApp.seekTo(${line.time})">
          <p class="font-headline-md text-headline-md font-semibold ${idx === 0 ? 'text-on-surface' : idx === 1 ? 'text-on-surface/90' : 'text-on-surface/60'} group-hover:text-primary-container transition-colors">${line.text}</p>
          <span class="font-label-sm text-label-sm text-on-surface-variant ml-space-sm">${formatTime(line.time)}</span>
        </div>
      `).join('');
    }
  }
}

window.wavenLyricsManager = new LyricsManager();
