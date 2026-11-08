const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testSearchFlowers() {
  const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
    "--headless=new",
    "--remote-debugging-port=9337",
    "--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_search2",
    "--disable-gpu",
    "--window-size=1400,900",
    "http://localhost:3000/#search"
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9337/json");
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
    throw new Error("No ws");
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

  await new Promise(r => setTimeout(r, 1500));

  const evalRes = await send("Runtime.evaluate", {
    expression: `
      window.searchManager.quickSearch('Flowers');
      document.getElementById('search-results-area').innerHTML.length;
    `,
    returnByValue: true
  });
  console.log("Quick search eval:", evalRes);

  await new Promise(r => setTimeout(r, 800));

  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  const outPath = path.join(__dirname, '..', 'snap_search_flowers.png');
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, "base64"));
  console.log(`Captured search for Flowers -> ${outPath}`);

  ws.close();
  edge.kill();
}

testSearchFlowers().catch(console.error);
