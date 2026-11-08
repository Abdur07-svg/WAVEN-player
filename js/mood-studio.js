/**
 * WAVEN — MOOD STUDIO
 * Curates vibe-based queues from local library metadata without artificial claims.
 * Uses genre tags, title heuristics, tempo/vibe scoring, and user-defined mood tags.
 */

class MoodStudio {
  constructor() {
    this.moods = [
      { id: "happy", name: "Happy", icon: "☀️", color: "#fbbf24", desc: "Upbeat melodies & positive energy" },
      { id: "sad", name: "Sad", icon: "🌧️", color: "#60a5fa", desc: "Reflective, acoustic & melancholic tones" },
      { id: "romantic", name: "Romantic", icon: "🌹", color: "#f43f5e", desc: "Soulful, intimate & heartfelt rhythms" },
      { id: "chill", name: "Chill", icon: "☕", color: "#2dd4bf", desc: "Laid-back lo-fi, ambient & smooth grooves" },
      { id: "focus", name: "Focus", icon: "🎧", color: "#818cf8", desc: "Instrumental, soundtrack & deep study beats" },
      { id: "energetic", name: "Energetic", icon: "⚡", color: "#f97316", desc: "High-voltage rock, EDM & driving rhythm" },
      { id: "peaceful", name: "Peaceful", icon: "🌿", color: "#34d399", desc: "Tranquil soundscapes & gentle serenity" },
      { id: "party", name: "Party", icon: "🎉", color: "#c084fc", desc: "Club anthems, heavy bass & dancefloor vibes" }
    ];

    this.activeMood = null;
  }

  getMoodById(moodId) {
    return this.moods.find(m => m.id === moodId) || null;
  }

  getTracksForMood(moodId) {
    if (!window.storageService) return [];
    const allTracks = window.storageService.getAllTracks();
    if (allTracks.length === 0) return [];

    const moodKeywords = {
      happy: {
        genres: ["pop", "dance", "funk", "disco", "happy", "upbeat", "indie pop"],
        words: ["sun", "love", "light", "happy", "groove", "joy", "smile", "good", "summer", "shine", "day", "gold"]
      },
      sad: {
        genres: ["blues", "acoustic", "ballad", "slow", "sad", "emo", "melancholy"],
        words: ["cry", "blue", "alone", "rain", "heart", "tears", "cold", "miss", "dark", "broken", "grey", "leave"]
      },
      romantic: {
        genres: ["r&b", "soul", "romance", "rhythm and blues", "love", "romantic"],
        words: ["love", "sweet", "kiss", "hold", "forever", "baby", "you", "heart", "night", "touch", "dream"]
      },
      chill: {
        genres: ["chill", "ambient", "lo-fi", "lofi", "downtempo", "acoustic", "jazz", "relax"],
        words: ["chill", "breeze", "night", "drift", "waves", "cafe", "sunset", "sky", "slow", "flow", "calm", "mellow"]
      },
      focus: {
        genres: ["classical", "instrumental", "soundtrack", "score", "ambient", "study"],
        words: ["focus", "mind", "piano", "calm", "study", "code", "zen", "theme", "interlude", "orchestra", "prelude"]
      },
      energetic: {
        genres: ["rock", "metal", "edm", "workout", "electronic", "punk", "hard rock", "trap"],
        words: ["power", "run", "fire", "fast", "speed", "beat", "heavy", "drive", "rock", "loud", "hype", "alive"]
      },
      peaceful: {
        genres: ["meditation", "nature", "peace", "ambient", "healing", "yoga", "new age"],
        words: ["peace", "calm", "gentle", "serene", "meditation", "sleep", "breathe", "water", "quiet", "forest"]
      },
      party: {
        genres: ["dance", "club", "remix", "electronic", "house", "techno", "dubstep", "rap", "hip hop"],
        words: ["party", "club", "dance", "remix", "bass", "dj", "night", "turn", "jump", "drop", "hit", "shake"]
      }
    };

    const target = moodKeywords[moodId] || { genres: [], words: [] };

    // Score and rank each track
    const scoredTracks = allTracks.map(track => {
      let score = 0;

      // 1. Explicit user mood tag (Highest Priority)
      if (track.mood && track.mood.toLowerCase() === moodId) {
        score += 15;
      }

      // 2. Genre match
      const trackGenre = (track.genre || "").toLowerCase();
      if (trackGenre) {
        for (const g of target.genres) {
          if (trackGenre.includes(g)) {
            score += 5;
            break;
          }
        }
      }

      // 3. Title & Album keywords
      const titleText = `${track.title || ""} ${track.album || ""}`.toLowerCase();
      for (const word of target.words) {
        if (titleText.includes(word)) {
          score += 2;
        }
      }

      return { track, score };
    });

    // Filter scored > 0 and sort by highest score
    const matched = scoredTracks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.track);

    return matched;
  }

  playMood(moodId) {
    const tracks = this.getTracksForMood(moodId);
    const mood = this.getMoodById(moodId);
    if (!mood) return;

    if (tracks.length === 0) {
      if (window.app) {
        window.app.showToast(`No local songs tagged for "${mood.name}" yet. Open Library Tools to tag your music!`, "info");
      }
      return;
    }

    if (window.player) {
      window.player.playTrack(tracks[0], tracks);
      if (window.app) {
        window.app.showToast(`Playing ${mood.icon} ${mood.name} Mix (${tracks.length} songs)`, "success");
      }
    }
  }

  selectMood(moodId) {
    this.activeMood = this.activeMood === moodId ? null : moodId;
    this.render();
  }

  render() {
    const container = document.getElementById("mood-studio-container");
    if (!container) return;

    const allTracks = window.storageService ? window.storageService.getAllTracks() : [];
    if (allTracks.length === 0) {
      container.innerHTML = "";
      return;
    }

    const moodPills = this.moods.map(mood => {
      const isSelected = this.activeMood === mood.id;
      const count = this.getTracksForMood(mood.id).length;
      return `
        <button class="mood-pill-btn ${isSelected ? 'active' : ''}" style="--mood-color: ${mood.color};" onclick="window.moodStudio.selectMood('${mood.id}')">
          <span class="mood-pill-icon">${mood.icon}</span>
          <span class="mood-pill-name">${mood.name}</span>
          ${count > 0 ? `<span class="mood-pill-badge">${count}</span>` : ''}
        </button>
      `;
    }).join("");

    let activePanelHtml = "";
    if (this.activeMood) {
      const currentMood = this.getMoodById(this.activeMood);
      const moodTracks = this.getTracksForMood(this.activeMood);

      if (moodTracks.length > 0) {
        const previewRows = moodTracks.slice(0, 5).map(t => {
          const art = window.getTrackArtwork ? window.getTrackArtwork(t) : (t.artwork || "assets/covers/default_cover.svg");
          const durStr = window.libraryManager ? window.libraryManager.formatDuration(t.duration || 0) : "0:00";
          return `
            <div class="mood-track-row" onclick="window.player.playTrack(window.storageService.getTrackById('${t.id}'), ${JSON.stringify(moodTracks.map(m => m.id))})">
              <img src="${art}" class="mood-track-art" alt="${t.title}" data-title="${t.title}" data-artist="${t.artist}" onerror="window.handleTrackImgError(this)" />
              <div class="mood-track-info">
                <span class="mood-track-title">${t.title || 'Unknown Title'}</span>
                <span class="mood-track-artist">${t.artist || 'Local Audio'}</span>
              </div>
              <span class="mood-track-dur">${durStr}</span>
            </div>
          `;
        }).join("");

        activePanelHtml = `
          <div class="mood-preview-panel">
            <div class="mood-preview-header">
              <div class="mood-preview-left">
                <span class="mood-preview-avatar" style="background: ${currentMood.color}22; border: 1px solid ${currentMood.color}44; color: ${currentMood.color};">${currentMood.icon}</span>
                <div>
                  <h4 class="mood-preview-title">${currentMood.name} Mix</h4>
                  <p class="mood-preview-desc">${currentMood.desc} • ${moodTracks.length} local song${moodTracks.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div class="mood-preview-actions">
                <button class="btn-primary mood-play-all-btn" onclick="window.moodStudio.playMood('${currentMood.id}')">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Play ${currentMood.name} Mix
                </button>
                <button class="glass-round-btn-sm" title="Close mood preview" onclick="window.moodStudio.selectMood('${currentMood.id}')">✕</button>
              </div>
            </div>
            <div class="mood-preview-tracks">
              ${previewRows}
            </div>
          </div>
        `;
      } else {
        activePanelHtml = `
          <div class="mood-preview-panel empty">
            <div class="mood-empty-content">
              <span class="mood-empty-icon">${currentMood.icon}</span>
              <h4 class="mood-empty-title">No ${currentMood.name} songs detected</h4>
              <p class="mood-empty-desc">
                Your local files do not have matching metadata for ${currentMood.name} yet.<br />
                You can tag any song with the "${currentMood.name}" mood in <strong>Library Tools</strong>!
              </p>
              <button class="btn-secondary" onclick="if (window.organizerManager) window.organizerManager.openToolsModal();" style="margin-top: 10px;">
                Open Library Tools to Tag Songs
              </button>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="mood-studio-wrapper">
        <div class="mood-studio-header">
          <div class="mood-title-group">
            <span class="mood-studio-tag">WAVEN VIBES</span>
            <h3 class="mood-studio-title">Mood Studio</h3>
          </div>
          <span class="mood-studio-hint">Select a mood to generate a curated local mix</span>
        </div>
        <div class="mood-pills-row">
          ${moodPills}
        </div>
        ${activePanelHtml}
      </div>
    `;
  }
}

window.moodStudio = new MoodStudio();

