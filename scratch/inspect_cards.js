const { spawn } = require('child_process');

async function testCards() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9345',
    '--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_fresh_' + Date.now(),
    '--disable-gpu',
    '--disable-application-cache',
    '--disk-cache-size=0',
    '--window-size=1400,900',
    'http://localhost:3000/#home'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9345/json');
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
  await new Promise(r => setTimeout(r, 1500));

  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = document.querySelectorAll('.waven-notched-card');
      return Array.from(cards).map((c, i) => {
        const rect = c.getBoundingClientRect();
        const cs = window.getComputedStyle(c);
        return {
          index: i,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          zIndex: cs.zIndex,
          transform: cs.transform
        };
      });
    })()`,
    returnByValue: true
  });

  console.log('Fresh Cards Info:', JSON.stringify(result.result.value, null, 2));

  ws.close();
  edge.kill();
}
testCards().catch(console.error);
