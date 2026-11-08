const { execSync } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const script = `
const items = Array.from(document.querySelectorAll('.capsule-nav-item')).map(el => ({
  text: el.textContent.trim(),
  className: el.className,
  computedBg: window.getComputedStyle(el).backgroundColor,
  computedColor: window.getComputedStyle(el).color
}));
document.title = JSON.stringify(items);
`;

const html = execSync(`"${edgePath}" --headless=new --run-all-compositor-stages-before-draw --dump-dom "http://localhost:3000/#playlist"`, { encoding: 'utf-8' });
const match = html.match(/<nav class="floating-capsule-nav">[\s\S]*?<\/nav>/);
console.log(match ? match[0] : 'not found');

