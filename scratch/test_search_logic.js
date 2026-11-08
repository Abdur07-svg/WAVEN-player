global.window = {};
require('../js/catalog.js');

const allTracks = window.WAVEN_CATALOG.getAllTracks();
const q = 'flowers';
const matched = allTracks.filter(t =>
  (t.title && t.title.toLowerCase().includes(q)) ||
  (t.artist && t.artist.toLowerCase().includes(q))
);
console.log('Matched for "flowers":', matched.map(m => m.title));
