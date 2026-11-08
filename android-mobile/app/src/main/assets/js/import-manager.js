/**
 * AR7 MUSIC — LOCAL AUDIO IMPORT MANAGER
 * Handles single-file, multi-file, directory/folder imports, recursive drag-and-drop,
 * duplicate detection, progress reporting, and non-blocking metadata extraction.
 */

class ImportManager {
  constructor() {
    this.supportedExtensions = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus", "weba"]);
    this.isImporting = false;
  }

  init() {
    this._bindFileInputs();
    this._bindGlobalDragAndDrop();
  }

  _bindFileInputs() {
    const fileInput = document.getElementById("local-file-picker");
    const folderInput = document.getElementById("local-folder-picker");

    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          await this.importFiles(files);
          fileInput.value = ""; // Reset for re-selection
        }
      });
    }

    if (folderInput) {
      folderInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          await this.importFiles(files);
          folderInput.value = "";
        }
      });
    }
  }

  _bindGlobalDragAndDrop() {
    const overlay = document.getElementById("drag-drop-overlay");

    let dragCounter = 0;

    window.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      if (overlay) overlay.classList.add("active");
    });

    window.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (overlay) overlay.classList.remove("active");
      }
    });

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    window.addEventListener("drop", async (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (overlay) overlay.classList.remove("active");

      const items = e.dataTransfer ? e.dataTransfer.items : null;
      const files = e.dataTransfer ? Array.from(e.dataTransfer.files || []) : [];

      if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === "function") {
        const collectedFiles = [];
        const entries = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry();
          if (entry) entries.push(entry);
        }
        await this._traverseEntries(entries, collectedFiles);
        if (collectedFiles.length > 0) {
          return this.importFiles(collectedFiles);
        }
      }

      if (files.length > 0) {
        await this.importFiles(files);
      }
    });
  }

  async _traverseEntries(entries, result) {
    for (const entry of entries) {
      if (entry.isFile) {
        await new Promise((resolve) => {
          entry.file((file) => {
            if (this.isSupportedFile(file.name)) {
              result.push(file);
            }
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readAllEntries = async () => {
          return new Promise((resolve) => {
            dirReader.readEntries(async (subEntries) => {
              if (!subEntries || subEntries.length === 0) {
                resolve();
              } else {
                await this._traverseEntries(subEntries, result);
                await readAllEntries();
                resolve();
              }
            }, () => resolve());
          });
        };
        await readAllEntries();
      }
    }
  }

  isSupportedFile(filename) {
    if (!filename || !filename.includes(".")) return false;
    const ext = filename.split(".").pop().toLowerCase();
    return this.supportedExtensions.has(ext);
  }

  /**
   * Main import handler for an array of File objects
   */
  async importFiles(files) {
    if (!files || files.length === 0) return;
    if (this.isImporting) {
      if (window.app) window.app.showToast("Import already in progress...", "info");
      return;
    }

    this.isImporting = true;
    this.showProgressModal(files.length);

    const validFiles = [];
    let skippedUnsupported = 0;

    for (const file of files) {
      if (this.isSupportedFile(file.name)) {
        validFiles.push(file);
      } else {
        skippedUnsupported++;
      }
    }

    if (validFiles.length === 0) {
      this.hideProgressModal();
      this.isImporting = false;
      if (window.app) {
        window.app.showToast(`No supported audio files found. (Supported: MP3, WAV, OGG, M4A, AAC, FLAC)`, "error");
      }
      return;
    }

    const newTracks = [];
    let duplicatesCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const signature = `${file.name}_${file.size}_${file.lastModified}`;

      this.updateProgressModal(i + 1, validFiles.length, file.name);

      // Check duplicates
      if (window.storageService.isDuplicate(signature)) {
        duplicatesCount++;
        continue;
      }

      try {
        const metadata = await window.MetadataParser.parseFile(file);
        const track = {
          id: "loc_" + Date.now() + "_" + Math.floor(Math.random() * 1000000),
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          duration: metadata.duration,
          trackNumber: metadata.trackNumber,
          genre: metadata.genre,
          year: metadata.year,
          artwork: metadata.artwork,
          hasEmbeddedArtwork: metadata.hasEmbeddedArtwork,
          sourceType: "local-file",
          sourceReference: file.name,
          file: file,
          fileSignature: signature,
          fileName: file.name,
          fileSize: file.size,
          fileType: metadata.fileType,
          formatName: metadata.formatName,
          addedAt: Date.now()
        };

        newTracks.push(track);
        successCount++;
      } catch (err) {
        console.error(`[ImportManager] Failed to parse ${file.name}:`, err);
        failedCount++;
      }

      // Small yield for smooth UI rendering during large imports
      if (i % 10 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (newTracks.length > 0) {
      await window.storageService.saveTracks(newTracks);
    }

    this.hideProgressModal();
    this.isImporting = false;

    // Report Summary
    let msg = `Loaded ${successCount} track${successCount === 1 ? '' : 's'} from your music storage.`;
    if (duplicatesCount > 0) msg += ` (${duplicatesCount} duplicate${duplicatesCount === 1 ? '' : 's'} skipped)`;
    if (skippedUnsupported > 0) msg += ` (${skippedUnsupported} non-audio skipped)`;
    if (failedCount > 0) msg += ` (${failedCount} unreadable)`;

    if (window.app) {
      window.app.showToast(msg, successCount > 0 ? "success" : "info");
    }

    // If player has no queue and we just imported songs, stage the first one without auto-playing
    if (window.player && !window.player.state.currentTrack && newTracks.length > 0) {
      window.player.state.currentTrack = newTracks[0];
      window.player._updateTrackInfoUI(newTracks[0]);
      if (window.queueManager) {
        window.queueManager.setQueue(newTracks, newTracks[0]);
      }
    }

    // Refresh view
    if (window.navigation) {
      if (window.navigation.currentView === "library" && window.libraryManager) {
        window.libraryManager.renderLibraryView();
      } else if (window.navigation.currentView === "home" && window.app) {
        window.app.loadHomeFeeds();
      }
    }
  }

  /**
   * Native Directory Picker via modern File System Access API
   */
  async openDirectoryPicker() {
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const files = [];
        await this._scanDirectoryHandle(dirHandle, files);
        if (files.length > 0) {
          await this.importFiles(files);
        } else {
          if (window.app) window.app.showToast("No audio files found in selected directory.", "info");
        }
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // User cancelled
        console.warn("[ImportManager] File System Access error, falling back to input:", err);
      }
    }

    // Fallback: trigger hidden folder input
    const folderInput = document.getElementById("local-folder-picker");
    if (folderInput) {
      folderInput.click();
    }
  }

  async _scanDirectoryHandle(dirHandle, files) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file") {
        if (this.isSupportedFile(entry.name)) {
          const file = await entry.getFile();
          files.push(file);
        }
      } else if (entry.kind === "directory") {
        await this._scanDirectoryHandle(entry, files);
      }
    }
  }

  triggerFilePicker() {
    const fileInput = document.getElementById("local-file-picker");
    if (fileInput) fileInput.click();
  }

  // -------------------------------------------------------------
  // IMPORT PROGRESS MODAL UI
  // -------------------------------------------------------------

  showProgressModal(total) {
    let modal = document.getElementById("import-progress-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "import-progress-modal";
      modal.className = "modal-overlay active";
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 440px; text-align: center;">
          <div class="import-spinner-wrap" style="margin: 0 auto 16px;">
            <div class="spinner-ring"></div>
          </div>
          <h3 class="modal-title" id="import-progress-title">Importing Music...</h3>
          <p id="import-progress-file" style="font-size: 0.85rem; color: var(--text-muted); margin: 8px 0 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Preparing files...</p>
          <div class="import-progress-bar-wrap" style="height: 6px; background: var(--bg-surface-elevated); border-radius: 999px; overflow: hidden; margin-bottom: 8px;">
            <div id="import-progress-fill" style="width: 0%; height: 100%; background: var(--accent-gradient); transition: width 0.15s ease;"></div>
          </div>
          <div id="import-progress-count" style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 500;">0 / ${total}</div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.classList.add("active");
      const title = document.getElementById("import-progress-title");
      if (title) title.textContent = "Importing Music...";
    }
  }

  updateProgressModal(current, total, filename) {
    const fill = document.getElementById("import-progress-fill");
    const count = document.getElementById("import-progress-count");
    const fileLabel = document.getElementById("import-progress-file");

    const pct = Math.round((current / total) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (count) count.textContent = `${current} / ${total} (${pct}%)`;
    if (fileLabel && filename) fileLabel.textContent = filename;
  }

  hideProgressModal() {
    const modal = document.getElementById("import-progress-modal");
    if (modal) modal.classList.remove("active");
  }
}

window.importManager = new ImportManager();
