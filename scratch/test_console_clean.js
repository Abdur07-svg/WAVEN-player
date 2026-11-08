const { spawn } = require('child_process');

async function testConsole() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9380',
    '--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_console_' + Date.now(),
    '--disable-gpu',
    '--window-size=1400,900',
    'http://localhost:3000/#home'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9380/json');
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

  const errors = [];
  ws.addEventListener('message', (e) => {
    const data = JSON.parse(e.data);
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      errors.push(data.params.args.map(a => a.value || a.description).join(' '));
    }
  });

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

  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 1200));

  console.log('Console Errors:', errors.length === 0 ? 'NONE (Clean!)' : errors);

  ws.close();
  edge.kill();
}
testConsole().catch(console.error);

