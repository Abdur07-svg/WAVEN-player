/**
 * WAVEN — Audio Engine & DSP Equalizer
 * Handles Native Android bridge commands and fallback HTML5 WebAudio engine with 6-band EQ.
 */

class AudioEngine {
  constructor() {
    this.isNative = typeof window.AndroidBridge !== 'undefined' || typeof window.WavenNative !== 'undefined';
    this.nativeBridge = window.AndroidBridge || window.WavenNative || null;

    // WebAudio context for fallback / DSP processing
    this.audioCtx = null;
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.audioElement.crossOrigin = 'anonymous';

    this.sourceNode = null;
    this.gainNode = null;
    this.bassNode = null;
    this.eqBands = [];
    this.eqEnabled = true;

    // 6-band frequencies (matching Nocturne Pulse reference: 60Hz, 150Hz, 400Hz, 1kHz, 2.4kHz, 15kHz)
    this.frequencies = [60, 150, 400, 1000, 2400, 15000];
    this.bandGains = [6, 4, 1, -1, 3, 5]; // Default: Bass Boost

    this.presets = {
      'Bass Boost': [6, 4, 1, -1, 3, 5],
      'Vocal Clarity': [-2, 0, 3, 6, 4, 1],
      'Club Pulse': [5, 4, 0, 2, 5, 4],
      'Acoustic': [2, 1, 2, 1, 3, 4],
      'Rock Stage': [4, 3, -1, 2, 4, 5],
      'Flat (Studio)': [0, 0, 0, 0, 0, 0]
    };

    this.spatialAudioEnabled = false;
    this.subBassIntensity = 65; // percentage

    this.initAudioContext();
  }

  initAudioContext() {
    if (this.audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);
        this.gainNode = this.audioCtx.createGain();

        // Create 6 BiquadFilterNodes
        this.eqBands = this.frequencies.map((freq, i) => {
          const filter = this.audioCtx.createBiquadFilter();
          if (i === 0) {
            filter.type = 'lowshelf';
          } else if (i === this.frequencies.length - 1) {
            filter.type = 'highshelf';
          } else {
            filter.type = 'peaking';
            filter.Q.value = 1.2;
          }
          filter.frequency.value = freq;
          filter.gain.value = this.bandGains[i];
          return filter;
        });

        // Sub-bass filter
        this.bassNode = this.audioCtx.createBiquadFilter();
        this.bassNode.type = 'lowshelf';
        this.bassNode.frequency.value = 80;
        this.bassNode.gain.value = (this.subBassIntensity - 50) / 10;

        // Chain nodes: Source -> Bass -> EQ[0..5] -> Gain -> Destination
        let prev = this.sourceNode;
        prev.connect(this.bassNode);
        prev = this.bassNode;

        this.eqBands.forEach(band => {
          prev.connect(band);
          prev = band;
        });

        prev.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
      }
    } catch (e) {
      console.warn('WebAudio DSP initialization deferred:', e);
    }
  }

  resumeContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playTrack(track) {
    this.resumeContext();

    if (this.isNative && this.nativeBridge) {
      try {
        const payload = JSON.stringify({
          title: track.title,
          artist: track.artist,
          uri: track.uri || track.filePath,
          isAsset: !!track.isAsset
        });
        this.nativeBridge.playTrack(payload);
        return;
      } catch (e) {
        console.warn('Native play failed, falling back to WebAudio:', e);
      }
    }

    // WebAudio HTML5 playback
    const src = track.uri || track.filePath || (track.isAsset ? 'assets/audio/' + track.file : '');
    if (src) {
      this.audioElement.src = src;
      this.audioElement.play().catch(err => {
        console.warn('Playback gesture required or blocked:', err);
      });
    }
  }

  togglePlayPause() {
    this.resumeContext();
    if (this.isNative && this.nativeBridge) {
      this.nativeBridge.togglePlayPause();
      return;
    }
    if (this.audioElement.paused) {
      this.audioElement.play();
    } else {
      this.audioElement.pause();
    }
  }

  pause() {
    if (this.isNative && this.nativeBridge) {
      this.nativeBridge.pauseAudio();
      return;
    }
    this.audioElement.pause();
  }

  resume() {
    this.resumeContext();
    if (this.isNative && this.nativeBridge) {
      this.nativeBridge.resumeAudio();
      return;
    }
    this.audioElement.play();
  }

  seekTo(seconds) {
    if (this.isNative && this.nativeBridge) {
      this.nativeBridge.seekTo(Math.round(seconds * 1000));
      return;
    }
    if (this.audioElement.duration) {
      this.audioElement.currentTime = Math.max(0, Math.min(seconds, this.audioElement.duration));
    }
  }

  setVolume(vol) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(vol, 1));
    }
    this.audioElement.volume = Math.max(0, Math.min(vol, 1));
  }

  setBandGain(index, gainDb) {
    this.bandGains[index] = gainDb;
    if (this.eqBands[index] && this.eqEnabled) {
      this.eqBands[index].gain.value = gainDb;
    }
  }

  applyPreset(presetName) {
    if (this.presets[presetName]) {
      const gains = this.presets[presetName];
      this.bandGains = [...gains];
      gains.forEach((g, i) => {
        if (this.eqBands[i] && this.eqEnabled) {
          this.eqBands[i].gain.value = g;
        }
      });
    }
  }

  toggleEq(enable) {
    this.eqEnabled = enable;
    this.eqBands.forEach((band, i) => {
      band.gain.value = enable ? this.bandGains[i] : 0;
    });
  }

  setSubBass(intensityPercent) {
    this.subBassIntensity = intensityPercent;
    if (this.bassNode) {
      // Maps 0..100% to -6dB .. +9dB
      const gain = ((intensityPercent - 50) / 50) * 8;
      this.bassNode.gain.value = gain;
    }
  }

  setSpatialAudio(enable) {
    this.spatialAudioEnabled = enable;
    // Simulates spherical soundstage with stereo widening
    if (this.bassNode) {
      this.bassNode.Q.value = enable ? 2.5 : 1.0;
    }
  }

  // Generates smooth SVG curve d path attribute through current band values
  getSvgCurvePath() {
    // Canvas dimensions: 300x50, base center at y=30 (0dB), range -12dB (y=45) to +12dB (y=10)
    const points = this.bandGains.map((db, i) => {
      const x = 28 + i * 50;
      const y = Math.max(8, Math.min(46, 28 - (db * 1.8)));
      return { x, y };
    });

    let path = `M 0,${points[0].y} Q 15,${points[0].y} ${points[0].x},${points[0].y} `;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      path += `Q ${p1.x + 20},${p1.y} ${mx},${my} T ${p2.x},${p2.y} `;
    }
    path += `L 300,${points[points.length - 1].y}`;
    return path;
  }
}

window.wavenAudioEngine = new AudioEngine();
