# PR Matrix

A tech-lead tool for managing concurrent PRs. Hosted service: GitHub OAuth in,
local repo folder picked in-browser, file-by-PR overlap matrix out.

## Architecture at a glance

- **`server/`** — Node/Express. Owns auth (GitHub OAuth + sessions), GitHub API
  calls (list PRs, merge), and user/observability persistence in Firestore.
  OAuth tokens are KMS-envelope-encrypted at rest.
- **`ui/`** — React + TypeScript (Vite). Browser-only local-git compute over
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
npm run dev        # vite dev server, serves the bundle from memory at https://localhost:7654
```

The Firestore emulator is launched automatically by the server in dev. Debug
logs land under `server/databases/firestore/setupAndRun/logs/` (gitignored).

## Cross-repo conventions and known gaps

See `BoilerPlateReadMe.md` at the repo root. It documents conventions shared
across every repo derived from the `express-react-appEngine-boilerPlate`
boilerplate (propagation rules, known gaps), and is meant to stay identical
across all derived repos — don't edit it at the project level. **Notable gap
to know upfront:** App Engine Standard does not support websockets, so any
Socket.IO channel won't work on the default `server/app.yaml` configuration.
Switch the server to `env: flex` (or Cloud Run) if you need realtime.
(PR Matrix doesn't currently use the realtime channel, but the boilerplate
ships it wired in.)

## Where to look first

- New to the server? Read `server/README.md`.
- New to the UI? Read `ui/README.md`.
- Adding a shared type? Read `TypesAndInterfaces/README.md`.
