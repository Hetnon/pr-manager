// pr-matrix/server/server.ts
// Express 5 + TypeScript entry. Endpoints live under ./routes/.

import express, { type Request, type Response, type NextFunction } from 'express';

import readConfig from './utils/readConfig.js';
import { PORT, PUBLIC_DIR, CONFIG_FILE } from './paths.js';

import configRoutes from './routes/config/index.js';
import prsRoutes from './routes/prs/index.js';
import reloadRoute from './routes/reload.js';
import pickFolderRoute from './routes/pick-folder.js';

const app = express();
app.disable('x-powered-by');

// API routes (all mounted under /api)
app.use('/api', reloadRoute);
app.use('/api', configRoutes);
app.use('/api', prsRoutes);
app.use('/api', pickFolderRoute);

// Static files
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  index: 'index.html',
}));

// Centralised error handler — Express 5 forwards rejected async errors here.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: (err as Error).message ?? 'Internal error' });
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  const cfg = readConfig(CONFIG_FILE);
  console.log(`PR Matrix server running at ${url}`);
  console.log(cfg.repoPath ? `Configured repo: ${cfg.repoPath}` : 'No repo configured yet — pick one in the UI.');
  console.log(`Open this URL in your browser if it isn't already: ${url}`);
});
