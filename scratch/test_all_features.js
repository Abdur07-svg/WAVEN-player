const { spawn } = require('child_process');
const fs = require('fs');

async function runVerification() {
  console.log("=== STARTING WAVEN FEATURE UPGRADE VERIFICATION ===");
  
  const edge = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
    "--headless=new",
    "--remote-debugging-port=9444",
    "--user-data-dir=C:\\Users\\ABDUR\\.gemini\\antigravity\\brain\\03748357-b801-4e1c-9e79-d0897829ee61\\scratch\\verify_edge",
    "--disable-gpu",
    "http://localhost:3000/#home"
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9444/json");
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
    throw new Error("Could not connect to Edge DevTools WebSocket");
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

  // Enable Log & Console
  await send("Console.enable");
  await send("Runtime.enable");

  const errors = [];
  ws.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);
    if (data.method === "Runtime.exceptionThrown") {
      errors.push(data.params.exceptionDetails);
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // 1. Check window objects
  const checkModules = await send("Runtime.evaluate", {
    expression: `({
      moodStudio: Boolean(window.moodStudio),
      forgottenGems: Boolean(window.forgottenGems),
      queueManager: Boolean(window.queueManager),
      musicInsights: Boolean(window.musicInsights),
      lyricsManager: Boolean(window.lyricsManager),
      immersiveManager: Boolean(window.immersiveManager),
      organizerManager: Boolean(window.organizerManager),
      storageService: Boolean(window.storageService),
      player: Boolean(window.player),
      navItems: document.querySelectorAll('.dock-item').length,
      playerButtons: {
        lyrics: Boolean(document.getElementById('player-card-lyrics-btn')),
        queue: Boolean(document.getElementById('player-card-queue-btn')),
        immersive: Boolean(document.getElementById('player-card-immersive-btn')),
        heart: Boolean(document.querySelector('.player-heart-btn'))
      }
    })`,
    returnByValue: true
  });

  console.log("Modules and UI Check:", JSON.stringify(checkModules.result.value, null, 2));

  // 2. Add some test audio tracks into IndexedDB to test Mood Studio, Forgotten Gems, and Insights
  console.log("Seeding test tracks into IndexedDB...");
  await send("Runtime.evaluate", {
    expression: `(async () => {
      const tracks = [
        {
          id: "track-happy-1",
          name: "Summer Sunshine.mp3",
          title: "Summer Sunshine",
          artist: "Sunny Beats",
          album: "Golden Vibes",
          genre: "Pop",
          mood: "happy",
          duration: 210,
          addedAt: Date.now() - 35 * 86400 * 1000,
          playCount: 12,
          lastPlayed: Date.now() - 32 * 86400 * 1000,
          format: "mp3"
        },
        {
          id: "track-chill-2",
          name: "Midnight Lo-Fi Rain.mp3",
          title: "Midnight Rain",
          artist: "Chill Dreamer",
          album: "Sleep Sounds",
          genre: "Lo-Fi",
          mood: "chill",
          duration: 185,
          addedAt: Date.now() - 70 * 86400 * 1000,
          playCount: 8,
          lastPlayed: Date.now() - 65 * 86400 * 1000,
          format: "flac"
        },
        {
          id: "track-energetic-3",
          name: "01 - Neon_Overdrive_320k.mp3",
          title: "01 - Neon_Overdrive_320k.mp3",
          artist: "Unknown Artist",
          album: "Cyber Beats",
          genre: "Electronic",
          duration: 240,
          addedAt: Date.now() - 100 * 86400 * 1000,
          playCount: 0,
          lastPlayed: null,
          format: "wav"
        }
      ];

      for (const t of tracks) {
        await window.storageService.saveTrack(t);
      }
      
      // Mark first track as favourite
      await window.storageService.toggleLike(tracks[0]);

      // Re-render home view
      window.app.loadHomeFeeds();
      return true;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 1000));

  // 3. Inspect Mood Studio and Forgotten Gems render
  const homeCheck = await send("Runtime.evaluate", {
    expression: `({
      moodPills: document.querySelectorAll('.mood-pill-btn').length,
      gemsCards: document.querySelectorAll('.gem-track-card').length,
      hubCards: document.querySelectorAll('.waven-hub-card').length,
      trackRows: document.querySelectorAll('.waven-track-row').length
    })`,
    returnByValue: true
  });

  console.log("Home Page Rendered Features:", JSON.stringify(homeCheck.result.value, null, 2));

  // 4. Test Insights View navigation
  await send("Runtime.evaluate", {
    expression: `window.navigation.navigateTo('insights')`
  });
  await new Promise(r => setTimeout(r, 800));

  const insightsCheck = await send("Runtime.evaluate", {
    expression: `({
      insightsViewActive: document.getElementById('insights-view').classList.contains('active-view'),
      archetypeTitle: document.querySelector('.dna-archetype-title')?.textContent,
      histogramBars: document.querySelectorAll('.histogram-bar').length,
      totalHours: document.querySelector('.dna-stat-val')?.textContent
    })`,
    returnByValue: true
  });

  console.log("Insights View Check:", JSON.stringify(insightsCheck.result.value, null, 2));

  // 5. Test Smart Library Organizer
  await send("Runtime.evaluate", {
    expression: `window.organizerManager.openToolsModal('cleaner')`
  });
  await new Promise(r => setTimeout(r, 600));

  const organizerCheck = await send("Runtime.evaluate", {
    expression: `({
      modalActive: document.getElementById('organizer-tools-modal')?.classList.contains('active'),
      cleanerRows: document.querySelectorAll('.organizer-clean-row').length
    })`,
    returnByValue: true
  });

  console.log("Library Organizer Check:", JSON.stringify(organizerCheck.result.value, null, 2));

  // 6. Test Right Player Card Queue and Lyrics Overlays
  await send("Runtime.evaluate", {
    expression: `(async () => {
      window.organizerManager.closeToolsModal();
      window.navigation.navigateTo('home');
      const track = window.storageService.getAllTracks()[0];
      await window.player.playTrack(track);
      window.queueManager.toggleExpandableQueue();
      return true;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 600));

  const queueOverlayCheck = await send("Runtime.evaluate", {
    expression: `({
      queueOverlayActive: document.getElementById('player-card-queue-overlay')?.classList.contains('active'),
      queueItems: document.querySelectorAll('#player-card-queue-overlay .queue-track-item').length
    })`,
    returnByValue: true
  });

  console.log("Queue Overlay Check:", JSON.stringify(queueOverlayCheck.result.value, null, 2));

  // 7. Test Immersive Mode
  await send("Runtime.evaluate", {
    expression: `(async () => {
      window.queueManager.toggleExpandableQueue();
      window.immersiveManager.open();
      return true;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 600));

  const immersiveCheck = await send("Runtime.evaluate", {
    expression: `({
      immersiveActive: document.getElementById('immersive-player-overlay')?.classList.contains('active'),
      canvasPresent: Boolean(document.getElementById('immersive-visualizer-canvas')),
      trackTitle: document.getElementById('immersive-track-title')?.textContent
    })`,
    returnByValue: true
  });

  console.log("Immersive Mode Check:", JSON.stringify(immersiveCheck.result.value, null, 2));

  // Close immersive mode and return to home
  await send("Runtime.evaluate", {
    expression: `window.immersiveManager.close()`
  });

  // Capture Screenshot of Home Page with Mood Studio & Forgotten Gems
  const snapRes = await send("Page.captureScreenshot", { format: "png" });
  if (snapRes && snapRes.data) {
    fs.writeFileSync("e:\\PROJECT\\Music player\\snap_home_upgraded.png", Buffer.from(snapRes.data, "base64"));
    console.log("Captured snap_home_upgraded.png successfully!");
  }

  // Check any runtime errors recorded
  if (errors.length > 0) {
    console.error("Runtime Exceptions Found:", errors);
  } else {
    console.log("SUCCESS: 0 Runtime Exceptions detected!");
  }

  ws.close();
  edge.kill();
  console.log("=== VERIFICATION COMPLETE ===");
}

runVerification().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});

