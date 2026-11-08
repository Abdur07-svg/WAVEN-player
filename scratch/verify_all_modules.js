/**
 * Comprehensive Node-based unit and integration test suite for WAVEN feature upgrade
 */

// 1. Setup mock browser environment
global.window = global;
global.document = {
  getElementById: (id) => {
    return {
      id,
      innerHTML: "",
      textContent: "",
      classList: {
        contains: () => false,
        add: () => {},
        remove: () => {},
        toggle: () => {}
      },
      style: {},
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    id: "",
    className: "",
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    style: {},
    appendChild: () => {}
  }),
  body: {
    appendChild: () => {}
  },
  documentElement: {
    setAttribute: () => {}
  }
};

global.CustomEvent = class CustomEvent {
  constructor(name, opts = {}) {
    this.type = name;
    this.detail = opts.detail;
  }
};

const listeners = {};
global.window.addEventListener = (evt, fn) => {
  listeners[evt] = listeners[evt] || [];
  listeners[evt].push(fn);
};
global.window.dispatchEvent = (evt) => {
  const fns = listeners[evt.type] || [];
  fns.forEach(fn => fn(evt));
};

const mockLocalStorage = {};
global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; }
};

global.Audio = class {
  constructor() {
    this.currentTime = 0;
    this.duration = 180;
    this.volume = 1;
    this.paused = true;
    this.listeners = {};
  }
  addEventListener(evt, fn) {
    this.listeners[evt] = this.listeners[evt] || [];
    this.listeners[evt].push(fn);
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
};

// 2. Load Modules
console.log("Loading modules...");
const fs = require('fs');

function loadModule(file) {
  const code = fs.readFileSync(file, 'utf8');
  eval(code);
}

loadModule('js/config.js');
loadModule('js/storage.js');
loadModule('js/mood-studio.js');
loadModule('js/forgotten-gems.js');
loadModule('js/queue.js');
loadModule('js/insights.js');
loadModule('js/lyrics.js');
loadModule('js/immersive.js');
loadModule('js/organizer.js');

console.log("All modules loaded successfully!");

// 3. Tests
console.log("\n--- TEST 1: Storage & History ---");
const track1 = {
  id: "t1",
  title: "Midnight Drive",
  artist: "Neon Skyline",
  album: "City Lights",
  genre: "Synthwave",
  mood: "chill",
  duration: 200,
  addedAt: Date.now() - 40 * 86400 * 1000,
  playCount: 15,
  lastPlayed: Date.now() - 35 * 86400 * 1000
};
const track2 = {
  id: "t2",
  title: "Morning Sun",
  artist: "Solar Ray",
  album: "Sunrise",
  genre: "Pop",
  mood: "happy",
  duration: 180,
  addedAt: Date.now() - 80 * 86400 * 1000,
  playCount: 5,
  lastPlayed: Date.now() - 65 * 86400 * 1000
};
const track3 = {
  id: "t3",
  title: "03 - Track_Unheard_128k.mp3",
  artist: "Unknown Artist",
  album: "Unknown Album",
  genre: "Rock",
  duration: 220,
  addedAt: Date.now() - 100 * 86400 * 1000,
  playCount: 0,
  lastPlayed: null
};

window.storageService.tracksCache = [track1, track2, track3];
window.storageService.favouritesSet.add("t1");

// Test Forgotten Gems
const gems = window.storageService.getForgottenGems();
console.log("Forgotten Gems 30d:", gems.thirtyDays.map(t => t.title));
console.log("Forgotten Gems 60d:", gems.sixtyDays.map(t => t.title));
console.log("Forgotten Gems Never Played:", gems.neverPlayed.map(t => t.title));
console.log("Forgotten Gems Dormant Faves:", gems.dormantFavourites.map(t => t.title));

if (gems.thirtyDays.length >= 2 && gems.neverPlayed.length === 1 && gems.dormantFavourites.length === 1) {
  console.log("✓ TEST 1 PASSED: Forgotten Gems categorizes correctly!");
} else {
  console.error("✗ TEST 1 FAILED: Unexpected Forgotten Gems output");
  process.exit(1);
}

// Test Exclusion
window.storageService.excludeFromForgottenGems("t1");
const gemsAfterExclusion = window.storageService.getForgottenGems();
if (!gemsAfterExclusion.thirtyDays.find(t => t.id === "t1")) {
  console.log("✓ TEST 1b PASSED: Excluded track successfully filtered out!");
} else {
  console.error("✗ TEST 1b FAILED: Track not excluded");
  process.exit(1);
}

console.log("\n--- TEST 2: Mood Studio ---");
const happyTracks = window.moodStudio.getTracksForMood("happy");
const chillTracks = window.moodStudio.getTracksForMood("chill");
console.log("Happy tracks detected:", happyTracks.map(t => t.title));
console.log("Chill tracks detected:", chillTracks.map(t => t.title));

if (happyTracks.some(t => t.id === "t2") && chillTracks.some(t => t.id === "t1")) {
  console.log("✓ TEST 2 PASSED: Mood Studio correctly scored tracks by mood tags & genres!");
} else {
  console.error("✗ TEST 2 FAILED: Mood Studio scoring failed");
  process.exit(1);
}

console.log("\n--- TEST 3: Smart Queue & Continue the Vibe ---");
window.queueManager.setQueue([track1, track2], track1);
console.log("Initial queue length:", window.queueManager.queue.length);
window.queueManager.continueTheVibe();
console.log("Queue length after 'Continue the Vibe':", window.queueManager.queue.length);
if (window.queueManager.queue.length === 3) {
  console.log("✓ TEST 3 PASSED: 'Continue the Vibe' added unqueued local tracks!");
} else {
  console.error("✗ TEST 3 FAILED: 'Continue the Vibe' did not add expected tracks");
  process.exit(1);
}

// Test Smart Shuffle toggle
window.queueManager.toggleSmartShuffle();
if (window.queueManager.isSmartShuffle === true) {
  console.log("✓ TEST 3b PASSED: Smart Shuffle toggled on!");
} else {
  console.error("✗ TEST 3b FAILED: Smart Shuffle toggle failed");
  process.exit(1);
}

console.log("\n--- TEST 4: Synchronized Lyrics Engine ---");
const testLrc = `[00:05.00]Line 1: Hello world\n[00:10.50]Line 2: Feeling good\n[00:15.00]Line 3: Goodbye`;
const parsedLyrics = window.lyricsManager.parseLyrics(testLrc);
console.log("Parsed LRC lines:", parsedLyrics.lines.length, "isLrc:", parsedLyrics.isLrc);

window.lyricsManager.lyricsData = parsedLyrics.lines;
window.lyricsManager.isLrc = parsedLyrics.isLrc;

// Sync at 00:07
window.lyricsManager.syncTime(7);
console.log("Active line at 7s:", window.lyricsManager.activeLineIndex, "(Expect 0: Line 1)");
// Sync at 00:12
window.lyricsManager.syncTime(12);
console.log("Active line at 12s:", window.lyricsManager.activeLineIndex, "(Expect 1: Line 2)");

if (parsedLyrics.isLrc && parsedLyrics.lines.length === 3 && window.lyricsManager.activeLineIndex === 1) {
  console.log("✓ TEST 4 PASSED: Lyrics engine parsed LRC timecodes & synced time correctly!");
} else {
  console.error("✗ TEST 4 FAILED: Lyrics parsing or sync failed");
  process.exit(1);
}

console.log("\n--- TEST 5: Smart Library Organizer & Cleaner ---");
const rawTitle = "01 - My_Great_Song [Official Music Video] 320kbps.mp3";
const cleanedTitle = window.organizerManager.cleanTitleString(rawTitle);
console.log("Raw title:    ", rawTitle);
console.log("Cleaned title:", cleanedTitle);

if (cleanedTitle === "My Great Song") {
  console.log("✓ TEST 5 PASSED: Filename title cleaner stripped track numbers, extensions, brackets & underscores perfectly!");
} else {
  console.error("✗ TEST 5 FAILED: Expected 'My Great Song' but got '" + cleanedTitle + "'");
  process.exit(1);
}

// Test Duplicate Detection
const duplicateTrack = {
  id: "t1_copy",
  title: "Midnight Drive",
  artist: "Neon Skyline",
  duration: 200.5,
  fileSize: 5000000
};
window.storageService.tracksCache.push(duplicateTrack);
const duplicates = window.organizerManager.findDuplicates();
console.log("Duplicate groups found:", duplicates.length);

if (duplicates.length === 1 && duplicates[0].length === 2) {
  console.log("✓ TEST 5b PASSED: Duplicate detection identified duplicate group!");
} else {
  console.error("✗ TEST 5b FAILED: Duplicate detection failed");
  process.exit(1);
}

console.log("\n--- TEST 6: Music DNA & Listening Insights ---");
const stats = window.storageService.getListeningStats();
console.log("Insights Stats Archetype:", stats.archetype.title);
console.log("Insights Total Verified Plays:", stats.totalPlays);
console.log("Insights Top Genres:", stats.topGenres);
console.log("Insights 7-Day Activity Length:", stats.dailyActivity.length);

if (stats.archetype && stats.dailyActivity.length === 7 && stats.topGenres.length > 0) {
  console.log("✓ TEST 6 PASSED: Music DNA generates valid personality archetype and 7-day listening histogram!");
} else {
  console.error("✗ TEST 6 FAILED: Music DNA stats generation failed");
  process.exit(1);
}

console.log("\n=======================================================");
console.log(" ALL 6 VERIFICATION TEST SUITES PASSED FLAWLESSLY! ");
console.log("=======================================================");

