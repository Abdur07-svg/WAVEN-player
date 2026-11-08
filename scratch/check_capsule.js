const { execSync } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const script = `
const items = Array.from(document.querySelectorAll('.capsule-nav-item')).map(el => ({
  text: el.textContent,
  classes: el.className,
  bg: window.getComputedStyle(el).backgroundColor,
  color: window.getComputedStyle(el).color
}));
console.log(JSON.stringify(items, null, 2));
`;

// Let's dump console output
try {
  const html = execSync(`"${edgePath}" --headless=new --dump-dom "http://localhost:3000/#playlist"`, { encoding: 'utf-8' });
  const regex = /<button class="capsule-nav-item[^"]*"[^>]*>(.*?)<\/button>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    console.log(match[0]);
  }
} catch(e) {
  console.error(e);
}

