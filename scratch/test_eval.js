const { spawn } = require('child_process');

async function testEval() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9362',
    '--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_eval',
    '--disable-gpu',
    '--window-size=1400,900',
    'http://localhost:3000/#home'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9362/json');
      const tabs = await res.json();
      const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost'));
      if (pageTab?.webSocketDebuggerUrl) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 200));
  }

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    const handler = (e) => {
      const data = JSON.parse(e.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        resolve(data);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => setTimeout(r, 1200));

  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const localSampleTracks = [
          {
            id: "loc_track_01",
            title: "Midnight City Lights",
            artist: "Alex Vance",
            album: "Neon Horizons",
            duration: 218,
            artwork: "assets/covers/selena.jpg",
            sourceType: "local-file",
            sourceReference: "Midnight City Lights.mp3",
            fileName: "Midnight City Lights.mp3",
            fileSize: 5420000,
            formatName: "MP3",
            addedAt: Date.now() - 50000
          }
        ];
        await window.storageService.saveTracks(localSampleTracks);
        window.app.hideStoragePermissionModal();
        return { success: true, modalClass: document.getElementById("storage-permission-modal")?.className };
      } catch(e) {
        return { error: e.message, stack: e.stack };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(res, null, 2));

  ws.close();
  edge.kill();
}
testEval().catch(console.error);

