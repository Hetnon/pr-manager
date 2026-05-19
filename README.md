# PR Matrix

A tech-lead tool for managing concurrent PRs. Hosted service: GitHub OAuth in,
local repo folder picked in-browser, file-by-PR overlap matrix out.

## Architecture at a glance

- **`server/`** — Node/Express. Owns auth (GitHub OAuth + sessions), GitHub API
  calls (list PRs, merge), and user/observability persistence in Firestore.
  OAuth tokens are KMS-envelope-encrypted at rest.
- **`ui/`** — React + TypeScript (Webpack). Browser-only local-git compute over
  the user's picked folder via the File System Access API + `isomorphic-git`.
- **`TypesAndInterfaces/`** — shared type definitions imported by both sides as
  `@shared/*` (alias configured in both tsconfigs).

## Running locally

```powershell
cd server
npm install
npm start          # https://localhost:3030
```

```powershell
cd ui
npm install
npm run watch      # rebuilds ui/public/app.js on save
```

The Firestore emulator is launched automatically by the server in dev. Debug
logs land under `server/databases/firestore/setupAndRun/logs/` (gitignored).

## Where to look first

- New to the server? Read `server/README.md`.
- New to the UI? Read `ui/README.md`.
- Adding a shared type? Read `TypesAndInterfaces/README.md`.
