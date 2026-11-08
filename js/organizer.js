/**
 * WAVEN — SMART LIBRARY ORGANIZER & METADATA STUDIO
 * Duplicate detection, missing artwork scanner, filename title cleaner,
 * and in-app metadata editor (Title, Artist, Album, Genre, Year, Mood Tag)
 * persisting 100% locally to IndexedDB without touching original disk files.
 */

class SmartLibraryOrganizer {
  constructor() {
    this.activeTool = "duplicates"; // "duplicates" | "cleaner" | "missing_art" | "editor"
    this.editingTrackId = null;
  }

  openToolsModal(tool = "duplicates") {
    this.activeTool = tool;
    let modal = document.getElementById("organizer-tools-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "organizer-tools-modal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    modal.classList.add("active");
    this.render();
  }

  closeToolsModal() {
    const modal = document.getElementById("organizer-tools-modal");
    if (modal) modal.classList.remove("active");
  }

  setTool(tool) {
    this.activeTool = tool;
    this.render();
  }

  /* -------------------------------------------------------------
     1. DUPLICATE DETECTION ENGINE
  ------------------------------------------------------------- */
  findDuplicates() {
    if (!window.storageService) return [];
    const allTracks = window.storageService.getAllTracks();
    const groups = [];
    const visited = new Set();

    for (let i = 0; i < allTracks.length; i++) {
      if (visited.has(allTracks[i].id)) continue;
      const t1 = allTracks[i];
      const matching = [t1];

      const normTitle1 = this._normalize(t1.title);
      const normArtist1 = this._normalize(t1.artist);

      for (let j = i + 1; j < allTracks.length; j++) {
        if (visited.has(allTracks[j].id)) continue;
        const t2 = allTracks[j];

        const normTitle2 = this._normalize(t2.title);
        const normArtist2 = this._normalize(t2.artist);

        // Same size/signature match
        const isSameSignature = (t1.fileSize && t2.fileSize && t1.fileSize === t2.fileSize && t1.name === t2.name);
        
        // Duration close (<1.5s) AND normalized title matches
        const durDiff = Math.abs((t1.duration || 0) - (t2.duration || 0));
        const isSimilarTitle = (normTitle1.length > 2 && normTitle1 === normTitle2);
        const isSimilarArtist = (!normArtist1 || !normArtist2 || normArtist1 === normArtist2);

        if (isSameSignature || (isSimilarTitle && isSimilarArtist && durDiff < 1.5)) {
          matching.push(t2);
          visited.add(t2.id);
        }
      }

      if (matching.length > 1) {
        visited.add(t1.id);
        groups.push(matching);
      }
    }

    return groups;
  }

  async removeDuplicate(trackId, title) {
    if (confirm(`Remove duplicate record "${title}" from your library?\n(Note: Original audio file on your disk remains untouched).`)) {
      if (window.storageService) {
        await window.storageService.deleteTrack(trackId);
        if (window.app) window.app.showToast(`Removed duplicate "${title}" from library`, "info");
        this.render();
      }
    }
  }

  /* -------------------------------------------------------------
     2. FILENAME TITLE CLEANER & METADATA REPAIR
  ------------------------------------------------------------- */
  findMessyMetadataTracks() {
    if (!window.storageService) return [];
    const allTracks = window.storageService.getAllTracks();

    return allTracks.filter(t => {
      const title = t.title || "";
      const isRawFilename = title.match(/^(\d{1,3}[\s._-]+|[a-zA-Z0-9_-]+\.(mp3|wav|flac|m4a|ogg)$)/i);
      const hasBrackets = title.match(/\[.*?\]|\(.*?(official|audio|video|lyrics|hd|4k|128k|320k).*?\)/i);
      const hasUnderscores = title.includes("_");
      const isUnknown = (!t.artist || t.artist === "Unknown Artist" || t.artist === "Local Audio");

      return isRawFilename || hasBrackets || hasUnderscores || isUnknown;
    });
  }

  cleanTitleString(rawTitle) {
    if (!rawTitle) return "Unknown Title";

    let cleaned = rawTitle;

    // Remove file extension
    cleaned = cleaned.replace(/\.(mp3|wav|flac|m4a|ogg|aac|wma)$/i, "");

    // Remove track number prefixes like "01 - ", "01. ", "01 "
    cleaned = cleaned.replace(/^(\d{1,3}[\s._-]+)/, "");

    // Remove YouTube tags and bitrate tags in brackets
    cleaned = cleaned.replace(/\[(official\s*(music\s*)?video|audio|lyrics|hd|4k|hq|128k|320k|remastered).*?\]/gi, "");
    cleaned = cleaned.replace(/\((official\s*(music\s*)?video|audio|lyrics|hd|4k|hq|128k|320k|remastered).*?\)/gi, "");

    // Remove standalone bitrate/quality indicators like "320kbps", "128k", "HQ"
    cleaned = cleaned.replace(/\b(320kbps|256kbps|192kbps|128kbps|320k|256k|192k|128k|hq|hd)\b/gi, "");

    // Replace underscores with spaces
    cleaned = cleaned.replace(/_/g, " ");

    // Remove web tags like "[SPOTIFY-DOWNLOAD.COM]"
    cleaned = cleaned.replace(/\[.*?(\.com|\.net|\.org).*?\]/gi, "");

    // Trim and normalize multiple spaces
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned || rawTitle;
  }

  async autoCleanTrack(trackId) {
    const track = window.storageService?.getTrackById(trackId);
    if (!track) return;

    const cleanedTitle = this.cleanTitleString(track.title || track.name);
    let cleanedArtist = track.artist;
    if (!cleanedArtist || cleanedArtist === "Unknown Artist") {
      cleanedArtist = "Local Audio";
    }

    await window.storageService.updateTrackMetadata(trackId, {
      title: cleanedTitle,
      artist: cleanedArtist
    });

    if (window.app) window.app.showToast(`Cleaned: "${cleanedTitle}"`, "success");
    this.render();
  }

  /* -------------------------------------------------------------
     3. MISSING ARTWORK SCANNER
  ------------------------------------------------------------- */
  findMissingArtworkTracks() {
    if (!window.storageService) return [];
    const allTracks = window.storageService.getAllTracks();
    return allTracks.filter(t => !t.artwork || t.artwork.includes("default_cover.svg") || t.artwork.includes("logo.svg"));
  }

  /* -------------------------------------------------------------
     4. IN-APP METADATA EDITOR MODAL
  ------------------------------------------------------------- */
  openTrackEditor(trackId) {
    const track = window.storageService?.getTrackById(trackId);
    if (!track) return;

    this.editingTrackId = trackId;
    let modal = document.getElementById("track-metadata-editor-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "track-metadata-editor-modal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    const moods = ["Happy", "Sad", "Romantic", "Chill", "Focus", "Energetic", "Peaceful", "Party"];
    const moodOptions = moods.map(m => `
      <option value="${m.toLowerCase()}" ${track.mood && track.mood.toLowerCase() === m.toLowerCase() ? 'selected' : ''}>${m}</option>
    `).join("");

    modal.innerHTML = `
      <div class="modal-card" style="max-width: 520px; width: 94%;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            <h3 class="modal-title" style="margin: 0;">Edit Track Details</h3>
          </div>
          <button class="modal-close-btn" onclick="window.organizerManager.closeTrackEditor()">✕</button>
        </div>

        <form onsubmit="window.organizerManager.handleTrackEditorSubmit(event)" style="padding: 16px 20px;">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Track Title</label>
            <input type="text" id="edit-meta-title" class="form-input" value="${this._escape(track.title || '')}" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Artist</label>
              <input type="text" id="edit-meta-artist" class="form-input" value="${this._escape(track.artist || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Album</label>
              <input type="text" id="edit-meta-album" class="form-input" value="${this._escape(track.album || '')}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Genre</label>
              <input type="text" id="edit-meta-genre" class="form-input" value="${this._escape(track.genre || '')}" placeholder="e.g. Pop, Rock, Lo-Fi" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Mood Studio Tag</label>
              <select id="edit-meta-mood" class="form-input" style="background: rgba(18, 22, 32, 0.95); color: #fff;">
                <option value="">-- No Mood Assigned --</option>
                ${moodOptions}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Year</label>
              <input type="text" id="edit-meta-year" class="form-input" value="${this._escape(track.year || '')}" placeholder="e.g. 2024" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Track Number</label>
              <input type="text" id="edit-meta-trackno" class="form-input" value="${this._escape(track.trackNumber || '')}" placeholder="e.g. 1" />
            </div>
          </div>

          <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn-secondary" onclick="window.organizerManager.closeTrackEditor()">Cancel</button>
            <button type="submit" class="btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    modal.classList.add("active");
  }

  closeTrackEditor() {
    const modal = document.getElementById("track-metadata-editor-modal");
    if (modal) modal.classList.remove("active");
    this.editingTrackId = null;
  }

  async handleTrackEditorSubmit(e) {
    e.preventDefault();
    if (!this.editingTrackId || !window.storageService) return;

    const title = document.getElementById("edit-meta-title").value.trim();
    const artist = document.getElementById("edit-meta-artist").value.trim();
    const album = document.getElementById("edit-meta-album").value.trim();
    const genre = document.getElementById("edit-meta-genre").value.trim();
    const mood = document.getElementById("edit-meta-mood").value;
    const year = document.getElementById("edit-meta-year").value.trim();
    const trackNo = document.getElementById("edit-meta-trackno").value.trim();

    await window.storageService.updateTrackMetadata(this.editingTrackId, {
      title: title || "Unknown Title",
      artist: artist || "Local Audio",
      album: album || "Local Audio",
      genre: genre || "",
      mood: mood || null,
      year: year || "",
      trackNumber: trackNo || ""
    });

    // Update active player track if currently playing
    const current = window.player?.state?.currentTrack;
    if (current && current.id === this.editingTrackId) {
      current.title = title;
      current.artist = artist;
      current.album = album;
      current.genre = genre;
      current.mood = mood;
      if (window.player._updateTrackInfoUI) {
        window.player._updateTrackInfoUI(current);
      }
    }

    if (window.app) window.app.showToast(`Updated metadata for "${title}"`, "success");
    this.closeTrackEditor();
    this.render();
  }

  /* -------------------------------------------------------------
     RENDER TOOLS MODAL
  ------------------------------------------------------------- */
  render() {
    const modal = document.getElementById("organizer-tools-modal");
    if (!modal) return;

    const duplicates = this.findDuplicates();
    const messyTracks = this.findMessyMetadataTracks();
    const missingArt = this.findMissingArtworkTracks();

    let toolContent = "";

    if (this.activeTool === "duplicates") {
      if (duplicates.length === 0) {
        toolContent = `
          <div class="organizer-empty-box">
            <span class="organizer-empty-icon">✨</span>
            <h4>No Duplicates Found</h4>
            <p>Your local music collection is clean! No identical tracks or matching song signatures detected.</p>
          </div>
        `;
      } else {
        const dupHtml = duplicates.map((group, gIdx) => {
          const rows = group.map((t, idx) => {
            const dur = window.player ? window.player.formatTime(t.duration) : "0:00";
            const sizeStr = t.fileSize ? `${(t.fileSize / (1024 * 1024)).toFixed(1)} MB` : "Local";
            return `
              <div class="organizer-dup-item">
                <div class="organizer-dup-info">
                  <span class="organizer-dup-badge">${idx === 0 ? 'KEEP' : 'DUPLICATE'}</span>
                  <div>
                    <strong>${this._escape(t.title)}</strong>
                    <span style="font-size: 0.74rem; color: var(--text-muted); display: block;">${this._escape(t.artist || 'Local Audio')} • ${dur} • ${sizeStr}</span>
                  </div>
                </div>
                ${idx > 0 ? `
                  <button class="organizer-danger-btn" onclick="window.organizerManager.removeDuplicate('${t.id}', '${this._escape(t.title)}')">
                    Remove Duplicate
                  </button>
                ` : `
                  <span style="font-size: 0.74rem; color: var(--accent-success); font-weight: 600;">Original</span>
                `}
              </div>
            `;
          }).join("");

          return `
            <div class="organizer-dup-group">
              <div class="organizer-group-header">Group #${gIdx + 1} (${group.length} instances)</div>
              ${rows}
            </div>
          `;
        }).join("");

        toolContent = `
          <div class="organizer-content-scroll">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
              Found ${duplicates.length} duplicate groups. Removing duplicates removes them from WAVEN's library while leaving your files safe on disk.
            </p>
            ${dupHtml}
          </div>
        `;
      }
    } else if (this.activeTool === "cleaner") {
      if (messyTracks.length === 0) {
        toolContent = `
          <div class="organizer-empty-box">
            <span class="organizer-empty-icon">🎉</span>
            <h4>Titles &amp; Artists Look Clean</h4>
            <p>None of your songs have messy filename prefixes, bitrate tags, or missing artists.</p>
          </div>
        `;
      } else {
        const rows = messyTracks.slice(0, 15).map(t => {
          const suggested = this.cleanTitleString(t.title || t.name);
          return `
            <div class="organizer-clean-row">
              <div style="flex: 1; overflow: hidden;">
                <div style="font-size: 0.82rem; color: #fff; text-decoration: line-through; opacity: 0.6;">${this._escape(t.title)}</div>
                <div style="font-size: 0.86rem; color: var(--accent-primary); font-weight: 600;">➔ ${this._escape(suggested)}</div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn-secondary" style="font-size: 0.75rem; padding: 4px 10px;" onclick="window.organizerManager.openTrackEditor('${t.id}')">Edit</button>
                <button class="btn-primary" style="font-size: 0.75rem; padding: 4px 10px;" onclick="window.organizerManager.autoCleanTrack('${t.id}')">Auto Clean</button>
              </div>
            </div>
          `;
        }).join("");

        toolContent = `
          <div class="organizer-content-scroll">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
              Detected ${messyTracks.length} tracks with raw filenames or missing tags. Click "Auto Clean" to instantly polish them!
            </p>
            ${rows}
          </div>
        `;
      }
    } else if (this.activeTool === "missing_art") {
      if (missingArt.length === 0) {
        toolContent = `
          <div class="organizer-empty-box">
            <span class="organizer-empty-icon">🎨</span>
            <h4>All Tracks Have Artwork</h4>
            <p>Every track in your collection has embedded or custom cover artwork.</p>
          </div>
        `;
      } else {
        const rows = missingArt.slice(0, 15).map(t => `
          <div class="organizer-clean-row">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 32px; height: 32px; border-radius: 4px; background: rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">🎵</div>
              <div>
                <strong style="font-size: 0.84rem; color: #fff;">${this._escape(t.title)}</strong>
                <span style="font-size: 0.74rem; color: var(--text-muted); display: block;">${this._escape(t.artist || 'Local Audio')}</span>
              </div>
            </div>
            <button class="btn-secondary" style="font-size: 0.75rem; padding: 4px 10px;" onclick="window.organizerManager.openTrackEditor('${t.id}')">Edit Tags</button>
          </div>
        `).join("");

        toolContent = `
          <div class="organizer-content-scroll">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
              ${missingArt.length} songs are missing album art.
            </p>
            ${rows}
          </div>
        `;
      }
    }

    modal.innerHTML = `
      <div class="modal-card organizer-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="3"></circle></svg>
            <h3 class="modal-title" style="margin: 0;">Smart Library Organizer</h3>
          </div>
          <button class="modal-close-btn" onclick="window.organizerManager.closeToolsModal()">✕</button>
        </div>

        <div class="organizer-nav-tabs">
          <button class="organizer-tab ${this.activeTool === 'duplicates' ? 'active' : ''}" onclick="window.organizerManager.setTool('duplicates')">
            Duplicates (${duplicates.length})
          </button>
          <button class="organizer-tab ${this.activeTool === 'cleaner' ? 'active' : ''}" onclick="window.organizerManager.setTool('cleaner')">
            Metadata Cleaner (${messyTracks.length})
          </button>
          <button class="organizer-tab ${this.activeTool === 'missing_art' ? 'active' : ''}" onclick="window.organizerManager.setTool('missing_art')">
            Missing Artwork (${missingArt.length})
          </button>
        </div>

        <div class="organizer-body">
          ${toolContent}
        </div>
      </div>
    `;
  }

  _normalize(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  _escape(str) {
    if (!str) return "";
    return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
}

window.organizerManager = new SmartLibraryOrganizer();
