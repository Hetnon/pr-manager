# ui

React + TypeScript, bundled by Webpack. Entry: `src/app.tsx`. Build output
lands in `dist/` (gitignored); `public/` holds the hand-written HTML template
and any static assets that ship verbatim (e.g. `styles.css`, favicons).

## Layout

| Folder | What it does |
|---|---|
| `api/` | Typed wrappers around server endpoints (`prs.ts`, `auth.ts`, `client.ts`, `csrf.ts`). |
| `auth/` | OAuth UI + session context. `AuthGate` blocks the app until login resolves. |
| `lib/` | View-agnostic helpers. `fileOverlap.ts` — the file-set overlap kernel shared by both views. |
| `components/` | Reusable, view-agnostic UI: `Modal` (MUI Dialog wrapper) and the generic `Matrix` grid. |
| `views/branches/` | "Branches" view — browser-side local-git: read branches, conflicts, render the local matrix. `BranchesView` is the container. See its README. |
| `views/pr/` | "Pull Requests" view — `PrView` owns the shared-file matrix (`sharedFiles.ts`); `DevActions` (quick actions), `MasterCheck` (master conflict overlay), `PrMatrix` (the GitHub-PR overlap grid). |
| `repo/` | Current-repo selection: `RepoProvider`/`useRepo` (context exposing repo, owner/name, folder handle, picker state), folder picker, IndexedDB-persisted FSAPI handle, `isomorphic-git` fs adapter. |
| `types/` | Ambient declarations (`global.d.ts`). |
| `public/` | Source HTML template (`index.html`) + static assets copied as-is. |
| `dist/` | Webpack output (gitignored). Produced by `npm run build`; in dev it lives in memory. |

## Dev commands

```powershell
npm run watch      # webpack-dev-server, serves the bundle from memory at https://localhost:7654
npm run build      # one-shot production bundle into dist/
npm run build:dev  # dev-mode build to dist/ (rarely needed; use `watch` for iteration)
```

`watch` reuses the API server's HTTPS certs from
`../server/keys/security_certificate/` when they exist, otherwise falls back
to HTTP. Hot reload is on; no disk writes happen during dev.

## Conventions

- Imports use `.js` extensions even for `.ts`/`.tsx` files (NodeNext-style;
  webpack's `extensionAlias` resolves them).
- Shared types come from `@shared/*` (aliased to `../TypesAndInterfaces`).
- CSS Modules for `*.module.css`; plain `*.css` stays global. Files in
  `public/` are copied to `dist/` at build time and served directly by the
  dev server — use this lane for global stylesheets and assets referenced by
  `index.html`.
- The Buffer global is provided via webpack's `ProvidePlugin` because
  `isomorphic-git`'s browser ESM build uses it without an explicit import.
