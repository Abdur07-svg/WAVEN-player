const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function captureView(viewName, hash) {
  const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
    "--headless=new",
    "--remote-debugging-port=9335",
    "--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_edge_snap",
    "--disable-gpu",
    "--window-size=1400,900",
    `http://localhost:3000/#${hash}`
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9335/json");
      const tabs = await res.json();
      const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost'));
      if (pageTab?.webSocketDebuggerUrl) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 200));
  }

  if (!wsUrl) {
    edge.kill();
    throw new Error("Could not find page websocket");
  }

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    const handler = (e) => {
      const data = JSON.parse(e.data);
      if (data.id === id) {
        ws.removeEventListener("message", handler);
        resolve(data.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => setTimeout(r, 1200));

  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  const outPath = path.join(__dirname, '..', `snap_${viewName}.png`);
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, "base64"));
  console.log(`Captured ${viewName} -> ${outPath}`);

  ws.close();
  edge.kill();
  await new Promise(r => setTimeout(r, 400));
}

async function runAll() {
  const views = [
    { name: 'home', hash: 'home' },
    { name: 'search', hash: 'search' },
    { name: 'playlist', hash: 'playlist' },
    { name: 'artists', hash: 'artists' },
    { name: 'albums', hash: 'albums' },
    { name: 'genres', hash: 'genres' }
  ];

  for (const v of views) {
    await captureView(v.name, v.hash);
  }
  console.log("All views captured successfully!");
}

runAll().catch(console.error);

