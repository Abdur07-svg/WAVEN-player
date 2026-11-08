const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function capture() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9355',
    '--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_open_' + Date.now(),
    '--disable-gpu',
    '--disable-application-cache',
    '--disk-cache-size=0',
    '--window-size=1400,900',
    'http://localhost:3000/#home'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9355/json');
      const tabs = await res.json();
      const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost'));
      if (pageTab?.webSocketDebuggerUrl) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 200));
  }

  if (!wsUrl) { edge.kill(); throw new Error('No ws'); }
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    const handler = (e) => {
      const data = JSON.parse(e.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Network.enable');
  await send('Network.clearBrowserCache');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 1200));

  // 1. Capture with Permission Modal open
  const shotModal = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '..', 'snap_permission_modal.png'), Buffer.from(shotModal.data, 'base64'));
  console.log('Captured snap_permission_modal.png');

  // 2. Close modal to see the Home Empty State
  await send('Runtime.evaluate', {
    expression: 'window.app.hideStoragePermissionModal()'
  });
  await new Promise(r => setTimeout(r, 500));

  const shotEmpty = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '..', 'snap_home_empty.png'), Buffer.from(shotEmpty.data, 'base64'));
  console.log('Captured snap_home_empty.png');

  ws.close();
  edge.kill();
}
capture().catch(console.error);

