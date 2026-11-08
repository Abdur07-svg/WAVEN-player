const { execSync } = require('child_process');
const fs = require('fs');
const outPath = 'e:\\PROJECT\\Music player\\current_snap.png';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

try {
  execSync(`"${edgePath}" --headless=new --screenshot="${outPath}" --window-size=1400,900 http://localhost:3000`, { timeout: 10000 });
  console.log('Finished. Exists:', fs.existsSync(outPath));
} catch (e) {
  console.error('Error:', e.message);
}

