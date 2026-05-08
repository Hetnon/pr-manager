# PR Matrix

Visual matrix of which files are touched by which open PRs in any local git repo.
Standalone — point it at any repo from the UI.

## Requirements

- Node.js ≥ 20 (uses `node --watch`)
- GitHub CLI (`gh`) authenticated to the relevant account
- One-time UI setup: `cd ui && npm install && npm run build`

## Usage

Start the server (auto-restarts on server code changes):

```powershell
cd server
npm start
```

The browser opens to `http://localhost:7654`.

- **First run:** the UI prompts you to pick a repository. Click **Browse…** to open a native folder picker, or paste a path. The choice is saved to `config.json`.
- **Subsequent runs:** the saved repo loads automatically.
- **Change repo at any time:** click **Change repo** in the header.

If the configured folder isn't a git repo, the UI shows an error and re-opens the picker.

### Editing the UI

The server only serves the bundled UI in `ui/public/`. To rebuild on save, run in a second terminal:

```powershell
cd ui
npm run watch
```

Webpack watches `ui/src/` and rewrites `ui/public/app.js` on every save. The server pushes a reload event over SSE and the browser refreshes itself — no manual reload needed.

For a one-shot build: `npm run build`.

### Matrix legend

- **Rows** = files touched by any open PR
- **Columns** = open PRs (sorted by PR number)
- **●** at a cell = that PR touches that file
- **Heat colors** on files: white (1 PR) → red (2+)
- **"Safe?" column** (after file name) = ✓ if file is in only 1 PR
- **"Good to Merge?" row** (top of body) = ✓ if PR shares no files with any other open PR
- **PR header background**: green = safe to merge alone, red = will conflict if merged with another open PR

Click ↻ Refresh to re-fetch from GitHub.

## Customization

- Change port: edit `PORT` in `server/server.js`
- Reset configured repo: delete `config.json` (or use **Change repo** in the UI)
