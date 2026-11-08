const { spawn } = require('child_process');

async function checkIndexedDB() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9351',
    '--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_idb',
    '--disable-gpu',
    '--window-size=1400,900',
    'http://localhost:3000/#home'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9351/json');
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

  await new Promise(r => setTimeout(r, 1200));

  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const tracks = window.storageService ? window.storageService.getAllTracks() : [];
      return {
        tracksCount: tracks.length,
        tracks: tracks.map(t => ({ id: t.id, title: t.title, artist: t.artist }))
      };
    })()`,
    returnByValue: true
  });

  console.log('IndexedDB tracks:', JSON.stringify(result.result.value, null, 2));

  ws.close();
  edge.kill();
}
checkIndexedDB().catch(console.error);

