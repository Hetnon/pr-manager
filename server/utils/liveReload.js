// Live-reload via Server-Sent Events. Watches `watchPath` (file or directory)
// and broadcasts a "reload" event to all connected SSE clients on change.
// The browser-side snippet in ui/public/index.html opens an EventSource and
// triggers location.reload() when it receives the event.

import fs from 'node:fs';
import path from 'node:path';

const DEBOUNCE_MS = 200;

export default function createLiveReload({ watchPath, watchFile = null }) {
  const clients = new Set();
  let debounce = null;

  function broadcast() {
    for (const res of clients) {
      try { res.write('event: reload\ndata: 1\n\n'); } catch { /* dead connection */ }
    }
  }

  function trigger() {
    clearTimeout(debounce);
    debounce = setTimeout(broadcast, DEBOUNCE_MS);
  }

  function startWatching() {
    try {
      fs.watch(watchPath, (_event, filename) => {
        if (watchFile && filename !== watchFile) return;
        trigger();
      });
    } catch (e) {
      console.warn(`live-reload: cannot watch ${watchPath}: ${e.message}`);
    }
  }

  function handler(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  startWatching();
  return { handler };
}
