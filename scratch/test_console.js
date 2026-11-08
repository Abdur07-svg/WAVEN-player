const { spawn } = require('child_process');

async function testConsole() {
  const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
    "--headless=new",
    "--remote-debugging-port=9339",
    "--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_cons",
    "--disable-gpu",
    "http://localhost:3000/#library"
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9339/json");
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

  await send("Log.enable");
  await send("Runtime.enable");

  const errors = [];
  ws.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);
    if (data.method === "Runtime.exceptionThrown") {
      errors.push(data.params.exceptionDetails);
    }
    if (data.method === "Log.entryAdded") {
      if (data.params.entry.level === "error") {
        errors.push(data.params.entry.text);
      }
    }
  });

  await new Promise(r => setTimeout(r, 1500));

  const contentLen = await send("Runtime.evaluate", {
    expression: "document.getElementById('library-view-content')?.innerHTML?.length || 0",
    returnByValue: true
  });
  console.log("library-view-content length:", contentLen);
  console.log("Errors caught:", JSON.stringify(errors, null, 2));

  ws.close();
  edge.kill();
}

testConsole().catch(console.error);

