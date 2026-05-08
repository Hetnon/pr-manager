// pr-matrix/server.js
// Tiny zero-dependency server that runs `gh` and serves a PR file-overlap matrix.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 7654;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// Run `gh pr list ...` from the parent of pr-matrix/ (i.e. project root).
// This lets you drop pr-matrix/ into any repo without configuration.
function fetchPRs() {
  return new Promise((resolve, reject) => {
    const cwd = path.resolve(__dirname, '..');
    const cmd = 'gh pr list --state open --json number,title,headRefName,mergeable,mergeStateStatus,files,updatedAt,author';

    exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error('Failed to parse gh output: ' + e.message));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // API endpoint
  if (req.url === '/api/prs') {
    try {
      const prs = await fetchPRs();
      res.writeHead(200, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify(prs));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Static files
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, urlPath);

  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`PR Matrix server running at ${url}`);
  console.log(`Reading PRs from: ${path.resolve(__dirname, '..')}`);

  // Open browser automatically (Windows)
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
});