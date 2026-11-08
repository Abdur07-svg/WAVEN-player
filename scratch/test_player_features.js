// Mock browser env
global.window = global;
global.document = {
  getElementById: (id) => ({
    id,
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    innerHTML: "",
    style: {},
    querySelectorAll: () => [],
    querySelector: () => null
  }),
  querySelectorAll: () => [],
  querySelector: () => null
};
global.CustomEvent = class { constructor(n, o = {}) { this.type = n; this.detail = o.detail; } };
global.window.addEventListener = () => {};
global.window.dispatchEvent = () => {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.Audio = class {
  constructor() {
    this.currentTime = 0;
    this.duration = 180;
    this.volume = 1;
    this.paused = true;
    this.listeners = {};
  }
  addEventListener(evt, fn) { this.listeners[evt] = this.listeners[evt] || []; this.listeners[evt].push(fn); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
};

const fs = require('fs');
eval(fs.readFileSync('js/config.js', 'utf8'));
eval(fs.readFileSync('js/storage.js', 'utf8'));
eval(fs.readFileSync('js/queue.js', 'utf8'));
eval(fs.readFileSync('js/player.js', 'utf8'));

console.log("Testing Sleep Timer...");
window.player.setSleepTimer(30);
if (window.player.sleepTimerInterval && window.player.sleepTimerTarget) {
  console.log("✓ Sleep timer set for 30 minutes!");
} else {
  console.error("✗ Sleep timer failed");
  process.exit(1);
}

window.player.clearSleepTimer();
if (!window.player.sleepTimerInterval && !window.player.sleepTimerTarget) {
  console.log("✓ Sleep timer cleared!");
} else {
  console.error("✗ Sleep timer clear failed");
  process.exit(1);
}

console.log("Testing Shuffle Cycle...");
// Default shuffle: false, isSmartShuffle: false
console.log("State 0:", window.player.state.shuffle, window.player.state.isSmartShuffle);
window.player.toggleShuffle(); // -> Normal Shuffle
console.log("State 1 (Normal):", window.player.state.shuffle, window.player.state.isSmartShuffle);
if (!window.player.state.shuffle || window.player.state.isSmartShuffle) {
  console.error("✗ Expected Normal Shuffle (shuffle=true, smart=false)");
  process.exit(1);
}
window.player.toggleShuffle(); // -> Smart Shuffle
console.log("State 2 (Smart):", window.player.state.shuffle, window.player.state.isSmartShuffle);
if (!window.player.state.shuffle || !window.player.state.isSmartShuffle) {
  console.error("✗ Expected Smart Shuffle (shuffle=true, smart=true)");
  process.exit(1);
}
window.player.toggleShuffle(); // -> Off
console.log("State 3 (Off):", window.player.state.shuffle, window.player.state.isSmartShuffle);
if (window.player.state.shuffle || window.player.state.isSmartShuffle) {
  console.error("✗ Expected Shuffle Off (shuffle=false, smart=false)");
  process.exit(1);
}

console.log("Testing Heart / Like toggle...");
const testTrack = { id: "song-1", title: "Test Song" };
window.player.state.currentTrack = testTrack;
window.storageService.tracksCache = [testTrack];

(async () => {
  await window.player.toggleLike();
  const liked = window.storageService.isLiked("song-1");
  console.log("Track liked:", liked);
  if (!liked) {
    console.error("✗ Expected track to be liked");
    process.exit(1);
  }
  await window.player.toggleLike();
  const unliked = window.storageService.isLiked("song-1");
  console.log("Track unliked:", !unliked);
  if (unliked) {
    console.error("✗ Expected track to be unliked");
    process.exit(1);
  }

  console.log("✓ ALL PLAYER TESTS PASSED!");
})();
