// Live-reload via Server-Sent Events. Watches `watchPath` (file or directory)
// and broadcasts a "reload" event to all connected SSE clients on change.
// The browser-side snippet in ui/public/index.html opens an EventSource and
// triggers location.reload() when it receives the event.

import fs from 'node:fs';
import type { Request, Response } from 'express';

const DEBOUNCE_MS = 200;

export interface LiveReloadOptions {
  watchPath: string;
  watchFile?: string | null;
}

export interface LiveReload {
  handler: (req: Request, res: Response) => void;
}

export default function createLiveReload({ watchPath, watchFile = null }: LiveReloadOptions): LiveReload {
  const clients = new Set<Response>();
  let debounce: NodeJS.Timeout | null = null;

  function broadcast(): void {
    for (const res of clients) {
      try { res.write('event: reload\ndata: 1\n\n'); } catch { /* dead connection */ }
    }
  }

  function trigger(): void {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(broadcast, DEBOUNCE_MS);
  }

  function startWatching(): void {
    try {
      fs.watch(watchPath, (_event, filename) => {
        if (watchFile && filename !== watchFile) return;
        trigger();
      });
    } catch (e) {
      console.warn(`live-reload: cannot watch ${watchPath}: ${(e as Error).message}`);
    }
  }

  function handler(req: Request, res: Response): void {
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
