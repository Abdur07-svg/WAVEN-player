const { execSync } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const html = execSync(`"${edgePath}" --headless=new --dump-dom "http://localhost:3000/#playlist"`, { encoding: 'utf-8' });
const navMatch = html.match(/<nav class="floating-capsule-nav">[\s\S]*?<\/nav>/);
console.log('Capsule Nav:', navMatch ? navMatch[0] : 'not found');
