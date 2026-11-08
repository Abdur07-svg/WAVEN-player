/**
 * AR7 MUSIC — CLIENT-SIDE AUDIO METADATA PARSER
 * Extracts ID3v1, ID3v2.2, ID3v2.3, and ID3v2.4 tags, embedded album artwork (APIC),
 * audio duration via loadedmetadata, and generates elegant gradient fallbacks.
 */

class MetadataParser {
  /**
   * Parse an audio File / Blob and return normalized track metadata.
   * @param {File} file
   * @returns {Promise<Object>}
   */
  static async parseFile(file) {
    const defaultMeta = this.extractFallbackFromFilename(file.name);
    let id3Meta = {};
    let duration = 0;
    let artworkUrl = null;

    try {
      id3Meta = await this.readID3Tags(file);
    } catch (err) {
      console.warn(`[MetadataParser] ID3 read error for ${file.name}:`, err);
    }

    // Extract exact duration via HTMLAudioElement
    try {
      duration = await this.extractDuration(file);
    } catch (err) {
      console.warn(`[MetadataParser] Duration extraction fallback for ${file.name}:`, err);
    }

    const title = (id3Meta.title && id3Meta.title.trim()) || defaultMeta.title;
    const artist = (id3Meta.artist && id3Meta.artist.trim()) || defaultMeta.artist;
    const album = (id3Meta.album && id3Meta.album.trim()) || defaultMeta.album;
    const trackNumber = parseInt(id3Meta.trackNumber, 10) || null;
    const genre = id3Meta.genre || "Local Music";
    const year = id3Meta.year || null;

    if (id3Meta.artwork) {
      artworkUrl = id3Meta.artwork;
    } else {
      artworkUrl = this.generateFallbackArtwork(title, artist);
    }

    const format = this.detectFormat(file.name, file.type);

    return {
      title,
      artist,
      album,
      duration: Math.round(duration) || 0,
      trackNumber,
      genre,
      year,
      artwork: artworkUrl,
      hasEmbeddedArtwork: Boolean(id3Meta.artwork),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || format.mime,
      formatName: format.name,
      lastModified: file.lastModified || Date.now()
    };
  }

  /**
   * Extract audio duration using a lightweight HTMLAudioElement
   */
  static extractDuration(file) {
    return new Promise((resolve) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      const objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;

      const cleanUp = () => {
        audio.removeAttribute("src");
        audio.load();
        URL.revokeObjectURL(objectUrl);
      };

      const timer = setTimeout(() => {
        cleanUp();
        resolve(0);
      }, 4000);

      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        const dur = audio.duration;
        cleanUp();
        resolve(isFinite(dur) ? dur : 0);
      };

      audio.onerror = () => {
        clearTimeout(timer);
        cleanUp();
        resolve(0);
      };
    });
  }

  /**
   * Parse ID3v2 / ID3v1 tags from file header and footer
   */
  static async readID3Tags(file) {
    const headerBuffer = await this.readSlice(file, 0, Math.min(file.size, 512 * 1024));
    const view = new DataView(headerBuffer);

    // Check ID3v2
    if (
      view.byteLength >= 10 &&
      view.getUint8(0) === 0x49 && // 'I'
      view.getUint8(1) === 0x44 && // 'D'
      view.getUint8(2) === 0x33    // '3'
    ) {
      const versionMajor = view.getUint8(3); // 2, 3, or 4
      const flags = view.getUint8(5);
      const tagSize = this.decodeSyncSafe(view.getUint32(6));
      const hasExtendedHeader = (flags & 0x40) !== 0;

      let offset = 10;
      if (hasExtendedHeader) {
        if (versionMajor === 4) {
          const extSize = this.decodeSyncSafe(view.getUint32(offset));
          offset += extSize;
        } else if (versionMajor === 3) {
          const extSize = view.getUint32(offset);
          offset += 4 + extSize;
        }
      }

      const limit = Math.min(view.byteLength, 10 + tagSize);
      const tags = {};

      while (offset < limit - (versionMajor === 2 ? 6 : 10)) {
        if (view.getUint8(offset) === 0) break; // Padding reached

        let frameId = "";
        let frameSize = 0;

        if (versionMajor === 2) {
          frameId = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2)
          );
          frameSize = (view.getUint8(offset + 3) << 16) | (view.getUint8(offset + 4) << 8) | view.getUint8(offset + 5);
          offset += 6;
        } else {
          frameId = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3)
          );
          if (versionMajor === 4) {
            frameSize = this.decodeSyncSafe(view.getUint32(offset + 4));
          } else {
            frameSize = view.getUint32(offset + 4);
          }
          offset += 10; // 4 ID + 4 Size + 2 Flags
        }

        if (frameSize <= 0 || offset + frameSize > limit) break;

        try {
          if (frameId === "TIT2" || frameId === "TT2") {
            tags.title = this.decodeTextFrame(view, offset, frameSize);
          } else if (frameId === "TPE1" || frameId === "TP1") {
            tags.artist = this.decodeTextFrame(view, offset, frameSize);
          } else if (frameId === "TALB" || frameId === "TAL") {
            tags.album = this.decodeTextFrame(view, offset, frameSize);
          } else if (frameId === "TRCK" || frameId === "TRK") {
            tags.trackNumber = this.decodeTextFrame(view, offset, frameSize);
          } else if (frameId === "TCON" || frameId === "TCO") {
            tags.genre = this.decodeGenre(this.decodeTextFrame(view, offset, frameSize));
          } else if (frameId === "TYER" || frameId === "TDRC" || frameId === "TYE") {
            tags.year = this.decodeTextFrame(view, offset, frameSize);
          } else if (frameId === "APIC" || frameId === "PIC") {
            if (!tags.artwork) {
              const art = this.decodePictureFrame(view, offset, frameSize, versionMajor);
              if (art) tags.artwork = art;
            }
          }
        } catch (e) {
          console.warn(`[MetadataParser] Error parsing frame ${frameId}:`, e);
        }

        offset += frameSize;
      }

      return tags;
    }

    // Try ID3v1 at end of file if size is at least 128 bytes
    if (file.size >= 128) {
      try {
        const footerBuffer = await this.readSlice(file, file.size - 128, file.size);
        const fView = new DataView(footerBuffer);
        if (
          fView.getUint8(0) === 0x54 && // 'T'
          fView.getUint8(1) === 0x41 && // 'A'
          fView.getUint8(2) === 0x47    // 'G'
        ) {
          return {
            title: this.decodeFixedString(fView, 3, 30),
            artist: this.decodeFixedString(fView, 33, 30),
            album: this.decodeFixedString(fView, 63, 30),
            year: this.decodeFixedString(fView, 93, 4)
          };
        }
      } catch (e) {
        // ID3v1 fallback ignored
      }
    }

    return {};
  }

  /**
   * Decode an ID3 text frame based on leading encoding byte
   */
  static decodeTextFrame(view, offset, length) {
    if (length <= 1) return "";
    const encoding = view.getUint8(offset);
    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset + 1, length - 1);
    return this.decodeEncodedString(bytes, encoding);
  }

  /**
   * Decode byte array according to ID3 encoding:
   * 0: ISO-8859-1 (Latin1)
   * 1: UTF-16 with BOM
   * 2: UTF-16BE without BOM
   * 3: UTF-8
   */
  static decodeEncodedString(bytes, encoding) {
    let str = "";
    if (encoding === 3) {
      // UTF-8
      str = new TextDecoder("utf-8").decode(bytes);
    } else if (encoding === 1 || encoding === 2) {
      // UTF-16
      try {
        str = new TextDecoder("utf-16").decode(bytes);
      } catch {
        str = new TextDecoder("utf-8").decode(bytes);
      }
    } else {
      // ISO-8859-1 (Latin1)
      try {
        str = new TextDecoder("iso-8859-1").decode(bytes);
      } catch {
        let res = "";
        for (let i = 0; i < bytes.length; i++) {
          res += String.fromCharCode(bytes[i]);
        }
        str = res;
      }
    }
    // Remove null terminators and trim
    return str.replace(/\0/g, "").trim();
  }

  /**
   * Decode APIC / PIC attached artwork frame
   */
  static decodePictureFrame(view, offset, length, versionMajor) {
    if (length < 8) return null;
    const start = view.byteOffset + offset;
    const end = start + length;
    let ptr = start;

    const encoding = view.getUint8(offset);
    ptr += 1;

    let mimeType = "image/jpeg";

    if (versionMajor === 2) {
      // 3-byte format ('JPG' or 'PNG')
      const fmt = String.fromCharCode(
        view.getUint8(ptr - view.byteOffset),
        view.getUint8(ptr + 1 - view.byteOffset),
        view.getUint8(ptr + 2 - view.byteOffset)
      ).toUpperCase();
      ptr += 3;
      mimeType = fmt === "PNG" ? "image/png" : "image/jpeg";
    } else {
      // Null-terminated MIME string
      let mimeStr = "";
      while (ptr < end && new Uint8Array(view.buffer, ptr, 1)[0] !== 0) {
        mimeStr += String.fromCharCode(new Uint8Array(view.buffer, ptr, 1)[0]);
        ptr++;
      }
      ptr++; // Skip null terminator
      if (mimeStr.trim()) {
        mimeType = mimeStr.toLowerCase();
      }
    }

    if (ptr >= end) return null;

    // Picture type (1 byte, e.g. 0x03 for front cover)
    ptr += 1;

    // Description (null-terminated string according to encoding)
    if (encoding === 1 || encoding === 2) {
      // UTF-16 requires 2 zero bytes
      while (ptr < end - 1) {
        const u8 = new Uint8Array(view.buffer, ptr, 2);
        if (u8[0] === 0 && u8[1] === 0) {
          ptr += 2;
          break;
        }
        ptr += 2;
      }
    } else {
      while (ptr < end && new Uint8Array(view.buffer, ptr, 1)[0] !== 0) {
        ptr++;
      }
      ptr++;
    }

    if (ptr >= end) return null;

    const imgByteLength = end - ptr;
    if (imgByteLength <= 0) return null;

    const imgBytes = new Uint8Array(view.buffer, ptr, imgByteLength);
    const blob = new Blob([imgBytes], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Helper to decode a syncsafe 32-bit integer (7 bits per byte)
   */
  static decodeSyncSafe(num) {
    return (
      ((num >> 24) & 0x7f) << 21 |
      ((num >> 16) & 0x7f) << 14 |
      ((num >> 8) & 0x7f) << 7 |
      (num & 0x7f)
    );
  }

  /**
   * Decode fixed-length ISO string for ID3v1
   */
  static decodeFixedString(view, offset, length) {
    let s = "";
    for (let i = 0; i < length; i++) {
      const code = view.getUint8(offset + i);
      if (code === 0) break;
      s += String.fromCharCode(code);
    }
    return s.trim();
  }

  /**
   * Decode ID3 numeric genre strings e.g. "(17)" => "Rock"
   */
  static decodeGenre(rawGenre) {
    if (!rawGenre) return "Local Music";
    const GENRE_MAP = [
      "Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop",
      "Jazz", "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap", "Reggae",
      "Rock", "Techno", "Industrial", "Alternative", "Ska", "Death Metal", "Pranks",
      "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk", "Fusion",
      "Trance", "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip",
      "Gospel", "Noise", "AlternRock", "Bass", "Soul", "Punk", "Space", "Meditative",
      "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic", "Darkwave",
      "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream", "Southern Rock",
      "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap", "Pop/Funk", "Jungle",
      "Native American", "Cabaret", "New Wave", "Psychedelic", "Rave", "Showtunes",
      "Trailer", "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka", "Retro",
      "Musical", "Rock & Roll", "Hard Rock", "Folk", "Folk-Rock", "National Folk",
      "Swing", "Fast Fusion", "Bebob", "Latin", "Revival", "Celtic", "Bluegrass",
      "Avantgarde", "Gothic Rock", "Progressive Rock", "Psychedelic Rock", "Symphonic Rock",
      "Slow Rock", "Big Band", "Chorus", "Easy Listening", "Acoustic", "Humour",
      "Speech", "Chanson", "Opera", "Chamber Music", "Sonata", "Symphony", "Booty Bass",
      "Primus", "Porn Groove", "Satire", "Slow Jam", "Club", "Tango", "Samba", "Folklore",
      "Ballad", "Power Ballad", "Rhythmic Soul", "Freestyle", "Duet", "Punk Rock",
      "Drum Solo", "A capella", "Euro-House", "Dance Hall"
    ];

    const match = rawGenre.match(/\((\d+)\)/);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (idx >= 0 && idx < GENRE_MAP.length) {
        return GENRE_MAP[idx];
      }
    }
    return rawGenre.replace(/\(\d+\)/g, "").trim() || "Local Music";
  }

  /**
   * Extract sensible fallback metadata from filename
   */
  static extractFallbackFromFilename(filename) {
    const raw = filename.replace(/\.[a-zA-Z0-9]+$/, "").trim();

    // Check for "Artist - Title" or "01 - Artist - Title" or "01. Artist - Title"
    const trackNumRegex = /^(\d{1,3})[\s._-]+/;
    let trackNum = null;
    let clean = raw;

    const numMatch = clean.match(trackNumRegex);
    if (numMatch) {
      trackNum = parseInt(numMatch[1], 10);
      clean = clean.replace(trackNumRegex, "");
    }

    if (clean.includes(" - ")) {
      const parts = clean.split(" - ");
      const artist = parts[0].trim();
      const title = parts.slice(1).join(" - ").trim();
      return {
        title: this.cleanName(title),
        artist: this.cleanName(artist),
        album: "Local Music",
        trackNumber: trackNum
      };
    }

    return {
      title: this.cleanName(clean),
      artist: "Unknown Artist",
      album: "Local Music",
      trackNumber: trackNum
    };
  }

  static cleanName(str) {
    if (!str) return "Unknown";
    return str
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Detect audio format and friendly name
   */
  static detectFormat(filename, mime) {
    const ext = filename.split(".").pop().toLowerCase();
    const map = {
      mp3: { name: "MP3 Audio", mime: "audio/mpeg" },
      wav: { name: "WAV Lossless", mime: "audio/wav" },
      ogg: { name: "OGG Vorbis", mime: "audio/ogg" },
      m4a: { name: "M4A / AAC", mime: "audio/mp4" },
      aac: { name: "AAC Audio", mime: "audio/aac" },
      flac: { name: "FLAC Lossless", mime: "audio/flac" },
      weba: { name: "WebA Audio", mime: "audio/webm" },
      opus: { name: "Opus Audio", mime: "audio/opus" }
    };

    return map[ext] || { name: (ext.toUpperCase() || "Audio") + " File", mime: mime || "audio/*" };
  }

  /**
   * Get deterministic 12-palette colors for track title and artist
   */
  static getPaletteForTrack(title = "", artist = "") {
    const text = `${title || ""} ${artist || ""}`;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    const palettes = [
      { c1: "#3b82f6", c2: "#1d4ed8", glow: "#60a5fa" }, // Royal Blue
      { c1: "#8b5cf6", c2: "#4c1d95", glow: "#a78bfa" }, // Electric Violet
      { c1: "#06b6d4", c2: "#0e7490", glow: "#38bdf8" }, // Ocean Cyan
      { c1: "#ec4899", c2: "#be185d", glow: "#f472b6" }, // Berry Pink
      { c1: "#10b981", c2: "#047857", glow: "#34d399" }, // Emerald Jade
      { c1: "#f59e0b", c2: "#b45309", glow: "#fbbf24" }, // Golden Sunset
      { c1: "#6366f1", c2: "#3730a3", glow: "#818cf8" }, // Deep Indigo
      { c1: "#ef4444", c2: "#f97316", glow: "#f87171" }, // Crimson Sunset
      { c1: "#14b8a6", c2: "#0f766e", glow: "#2dd4bf" }, // Modern Teal
      { c1: "#f43f5e", c2: "#ea580c", glow: "#fb7185" }, // Coral Rose
      { c1: "#7c3aed", c2: "#4f46e5", glow: "#a78bfa" }, // Neon Iris
      { c1: "#84cc16", c2: "#10b981", glow: "#a3e635" }  // Lime Forest
    ];

    return palettes[Math.abs(hash) % palettes.length];
  }

  /**
   * Generate an exquisite fallback album artwork SVG data URL
   * Uses title + artist hash to select harmonious modern gradients with glowing soundwave / note glyphs.
   */
  static generateFallbackArtwork(title, artist) {
    const chosen = this.getPaletteForTrack(title, artist);
    let initial = "♪";
    if (title && title.trim()) {
      const first = title.trim().charAt(0);
      if (/[a-zA-Z0-9]/.test(first)) {
        initial = first.toUpperCase();
      }
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${chosen.c1}" />
            <stop offset="100%" stop-color="${chosen.c2}" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="30%" r="65%">
            <stop offset="0%" stop-color="${chosen.glow}" stop-opacity="0.45" />
            <stop offset="100%" stop-color="${chosen.c2}" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="300" height="300" rx="28" fill="url(#bg)" />
        <rect width="300" height="300" rx="28" fill="url(#glow)" />
        <circle cx="150" cy="150" r="110" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2" stroke-dasharray="6 6" />
        <circle cx="150" cy="150" r="85" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
        <circle cx="150" cy="150" r="54" fill="rgba(0,0,0,0.40)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
        <text x="150" y="168" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="52" font-weight="800" fill="#ffffff" text-anchor="middle">${initial}</text>
      </svg>
    `.trim();

    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  static readSlice(file, start, end) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const slice = file.slice(start, end);
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(slice);
    });
  }
}

window.MetadataParser = MetadataParser;
