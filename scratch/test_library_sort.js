const { spawn } = require('child_process');

async function testLibrarySort() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9346',
    '--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\dbg_lib_' + Date.now(),
    '--disable-gpu',
    '--disable-application-cache',
    '--disk-cache-size=0',
    '--window-size=1400,900',
    'http://localhost:3000/#library'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9346/json');
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
      const row = document.querySelector('.library-subnav-row');
      const sortSelect = document.querySelector('.sort-select');
      const pills = document.querySelector('.subnav-pills');
      const sortWrapper = document.querySelector('.sort-select-wrapper');

      const csRow = row ? window.getComputedStyle(row) : null;
      const csSelect = sortSelect ? window.getComputedStyle(sortSelect) : null;
      const rPills = pills?.getBoundingClientRect();
      const rSelect = sortSelect?.getBoundingClientRect();

      return {
        rowDisplay: csRow?.display,
        rowJustify: csRow?.justifyContent,
        pillsRect: rPills ? { left: Math.round(rPills.left), top: Math.round(rPills.top), width: Math.round(rPills.width) } : null,
        selectRect: rSelect ? { left: Math.round(rSelect.left), top: Math.round(rSelect.top), width: Math.round(rSelect.width), height: Math.round(rSelect.height) } : null,
        selectBg: csSelect?.backgroundColor,
        selectColor: csSelect?.color,
        selectBorderRadius: csSelect?.borderRadius,
        selectPadding: csSelect?.padding,
        selectBorder: csSelect?.border
      };
    })()`,
    returnByValue: true
  });

  console.log('Library Sort Info:', JSON.stringify(result.result.value, null, 2));

  ws.close();
  edge.kill();
}
testLibrarySort().catch(console.error);

