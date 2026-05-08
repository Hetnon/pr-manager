// pr-matrix/server/server.js
// Tiny zero-dependency server: HTTP routing, static file serving, browser launch.
// Business logic lives under ./utils/.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import readConfig from './utils/readConfig.js';
import writeConfig from './utils/writeConfig.js';
import validateRepo from './utils/validateRepo.js';
import fetchPRs from './utils/fetchPRs.js';
import pickFolder from './utils/pickFolder.js';
import readJsonBody from './utils/readJsonBody.js';
import sendJson from './utils/sendJson.js';
import createLiveReload from './utils/liveReload.js';
import checkMasterConflict from './utils/checkMasterConflict.js';
import mergePr from './utils/mergePr.js';

const PORT = 7654;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'ui', 'public');
const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.json');

const liveReload = createLiveReload({ watchPath: PUBLIC_DIR, watchFile: 'app.js' });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/_reload') {
      return liveReload.handler(req, res);
    }

    if (req.method === 'GET' && req.url === '/api/config') {
      const cfg = readConfig(CONFIG_FILE);
      return sendJson(res, 200, { repoPath: cfg.repoPath || null });
    }

    if (req.method === 'POST' && req.url === '/api/config') {
      const body = await readJsonBody(req);
      const result = await validateRepo(body.repoPath);
      if (!result.ok) return sendJson(res, 400, { error: result.error });
      writeConfig(CONFIG_FILE, { repoPath: result.repoPath });
      return sendJson(res, 200, { repoPath: result.repoPath });
    }

    if (req.method === 'POST' && req.url === '/api/pick-folder') {
      const body = await readJsonBody(req).catch(() => ({}));
      try {
        const picked = await pickFolder(body.initialDir);
        return sendJson(res, 200, { path: picked });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    if (req.method === 'POST' && req.url === '/api/merge-pr') {
      const cfg = readConfig(CONFIG_FILE);
      if (!cfg.repoPath) return sendJson(res, 400, { error: 'No repository configured.' });
      const v = await validateRepo(cfg.repoPath);
      if (!v.ok) return sendJson(res, 400, { error: v.error });
      const body = await readJsonBody(req).catch(() => ({}));
      if (!body.prNumber) return sendJson(res, 400, { error: 'prNumber required' });
      const result = await mergePr(cfg.repoPath, body.prNumber, body.strategy);
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    if (req.method === 'POST' && req.url === '/api/master-conflicts') {
      const cfg = readConfig(CONFIG_FILE);
      if (!cfg.repoPath) return sendJson(res, 400, { error: 'No repository configured.' });
      const v = await validateRepo(cfg.repoPath);
      if (!v.ok) return sendJson(res, 400, { error: v.error });
      const body = await readJsonBody(req).catch(() => ({}));
      const prNumbers = Array.isArray(body.prNumbers) ? body.prNumbers : [];
      const results = {};
      for (const n of prNumbers) {
        results[n] = await checkMasterConflict(cfg.repoPath, n);
      }
      return sendJson(res, 200, { results });
    }

    if (req.method === 'GET' && req.url === '/api/prs') {
      const cfg = readConfig(CONFIG_FILE);
      if (!cfg.repoPath) {
        return sendJson(res, 400, { error: 'No repository configured.', needsRepo: true });
      }
      const v = await validateRepo(cfg.repoPath);
      if (!v.ok) return sendJson(res, 400, { error: v.error, needsRepo: true });
      try {
        const prs = await fetchPRs(cfg.repoPath);
        return sendJson(res, 200, prs);
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // Static files
    const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = path.join(PUBLIC_DIR, urlPath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  const cfg = readConfig(CONFIG_FILE);
  console.log(`PR Matrix server running at ${url}`);
  console.log(cfg.repoPath ? `Configured repo: ${cfg.repoPath}` : 'No repo configured yet — pick one in the UI.');
  console.log(`Open this URL in your browser if it isn't already: ${url}`);
});
