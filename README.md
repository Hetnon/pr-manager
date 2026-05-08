# PR Matrix

Visual matrix of which files are touched by which open PRs in this repo.
Drop this folder into any GitHub-hosted git repo to use it.

## Requirements

- Node.js (any modern version, no npm install needed)
- GitHub CLI (`gh`) authenticated to the relevant account
- Run from a folder one level inside a git repo

## Usage

From the repo root:

```powershell
.\pr-matrix\start.ps1
```

Browser opens to `http://localhost:7654` showing:

- **Rows** = files touched by any open PR
- **Columns** = open PRs (sorted by PR number)
- **●** at a cell = that PR touches that file
- **Heat colors** on files: white (1 PR) → yellow (2) → orange (3) → red (4+)
- **Right column** "Safe?" = ✓ if file is in only 1 PR
- **Bottom row** "Good to Merge?" = ✓ if PR shares no files with any other open PR
- **PR header background**: green = safe to merge alone, red = will conflict if merged with another open PR

Click ↻ Refresh to re-fetch from GitHub.

## Customization

- Change port: edit `PORT` in `server.js`
- Add columns (e.g., status, mergeable): edit `app.js` render() function