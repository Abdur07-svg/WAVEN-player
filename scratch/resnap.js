const { execSync } = require('child_process');
const fs = require('fs');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const views = ['playlist', 'genres'];

views.forEach(v => {
  const outPath = `e:\\PROJECT\\Music player\\snap_${v}.png`;
  try {
    execSync(`"${edgePath}" --headless=new --screenshot="${outPath}" --virtual-time-budget=2000 --window-size=1400,900 "http://localhost:3000/#${v}"`, { timeout: 15000 });
    console.log(`Captured ${v}:`, fs.existsSync(outPath));
  } catch(e) {
    console.error(`Error on ${v}:`, e.message);
  }
});

