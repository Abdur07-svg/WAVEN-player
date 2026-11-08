const { spawn } = require('child_process');

async function test() {
  const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
    "--headless=new",
    "--remote-debugging-port=9334",
    "--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_edge2",
    "--disable-gpu",
    "http://localhost:3000/#playlist"
  ]);

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9334/json");
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
      Array.from(document.querySelectorAll('.capsule-nav-item')).map(el => ({
        text: el.textContent.trim(),
        class: el.className,
        bg: window.getComputedStyle(el).backgroundColor,
        color: window.getComputedStyle(el).color
      }))
    `,
    returnByValue: true
  });

  console.log("Evaluation result:", JSON.stringify(evalRes.result.value, null, 2));

  ws.close();
  edge.kill();
}

test().catch(console.error);
