const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testWithLocalMusic() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9375',
    '--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_run_' + Date.now(),
    '--disable-gpu',
    '--window-size=1400,900',
    'http://localhost:3000/#home'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9375/json');
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

  // Populate IndexedDB with local songs and close permission modal
  const evalRes = await send('Runtime.evaluate', {
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
          },
          {
            id: "loc_track_02",
            title: "Ocean Echoes",
            artist: "Elena Woods",
            album: "Coastal Vibes",
            duration: 194,
            artwork: "assets/covers/billie.jpg",
            sourceType: "local-file",
            sourceReference: "Ocean Echoes.flac",
            fileName: "Ocean Echoes.flac",
            fileSize: 22400000,
            formatName: "FLAC",
            addedAt: Date.now() - 40000
          },
          {
            id: "loc_track_03",
            title: "Solar Drift",
            artist: "Kavinsky Sound",
            album: "Outrun 1984",
            duration: 245,
            artwork: "assets/covers/dua.jpg",
            sourceType: "local-file",
            sourceReference: "Solar Drift.wav",
            fileName: "Solar Drift.wav",
            fileSize: 42100000,
            formatName: "WAV",
            addedAt: Date.now() - 30000
          },
          {
            id: "loc_track_04",
            title: "Acoustic Morning",
            artist: "Liam Cooper",
            album: "Coffee & Guitar",
            duration: 178,
            artwork: "assets/covers/manchild.jpg",
            sourceType: "local-file",
            sourceReference: "Acoustic Morning.m4a",
            fileName: "Acoustic Morning.m4a",
            fileSize: 6100000,
            formatName: "M4A",
            addedAt: Date.now() - 20000
          },
          {
            id: "loc_track_05",
            title: "Velvet Nights",
            artist: "Sofia Rivera",
            album: "Late Hours",
            duration: 230,
            artwork: "assets/covers/flowers.jpg",
            sourceType: "local-file",
            sourceReference: "Velvet Nights.mp3",
            fileName: "Velvet Nights.mp3",
            fileSize: 7200000,
            formatName: "MP3",
            addedAt: Date.now() - 10000
          }
        ];

        await window.storageService.saveTracks(localSampleTracks);
        await window.storageService.addToHistory(localSampleTracks[0]);
        window.storageService.addToLiked("loc_track_02");

        window.app.loadHomeFeeds();
        window.app._syncInitialHeroPlayer();
        const modal = document.getElementById("storage-permission-modal");
        if (modal) {
          modal.classList.remove("active");
          modal.style.display = "none";
        }
        return { ok: true };
      } catch (err) {
        return { err: err.message, stack: err.stack };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Eval Result:', evalRes.result?.value);
  await new Promise(r => setTimeout(r, 800));

  // Capture Home with real local songs
  const shotHome = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '..', 'snap_home_populated.png'), Buffer.from(shotHome.data, 'base64'));
  console.log('Captured snap_home_populated.png');

  // Navigate to Library and capture
  await send('Runtime.evaluate', {
    expression: 'window.navigation.navigateTo("library")'
  });
  await new Promise(r => setTimeout(r, 800));

  const shotLib = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '..', 'snap_library_populated.png'), Buffer.from(shotLib.data, 'base64'));
  console.log('Captured snap_library_populated.png');

  ws.close();
  edge.kill();
}
testWithLocalMusic().catch(console.error);
