const { execSync } = require('child_process');
const fs = require('fs');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const views = ['home', 'search', 'playlist', 'artists', 'albums', 'genres', 'liked'];

views.forEach(v => {
  const outPath = `e:\\PROJECT\\Music player\\snap_${v}.png`;
  try {
    const url = v === 'home' ? 'http://localhost:3000/' : `http://localhost:3000/#${v}`;
    execSync(`"${edgePath}" --headless=new --screenshot="${outPath}" --window-size=1400,900 "${url}"`, { timeout: 10000 });
    console.log(`Captured ${v}:`, fs.existsSync(outPath));
  } catch(e) {
    console.error(`Error on ${v}:`, e.message);
  }
});
