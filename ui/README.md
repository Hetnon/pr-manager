# ui

React + TypeScript, bundled by Webpack. Entry: `src/app.tsx`. Build output
lands in `dist/` (gitignored); `public/` holds the hand-written HTML template
and any static assets that ship verbatim (e.g. `styles.css`, favicons).

## Layout

| Folder | What it does |
|---|---|
| `api/` | Typed wrappers around server endpoints (`prs.ts`, `auth.ts`, `client.ts`, `csrf.ts`). |
| `auth/` | OAuth UI + session context. `AuthGate` blocks the app until login resolves. |
| `lib/` | Pure helpers (currently just `matrix.ts` — the file/PR overlap math). |
| `localBranches/` | Browser-side local-git: read branches, conflicts, render the local matrix. See its README. |
| `masterCheck/` | "Master conflict check" view — overlays master-side conflict data on the PR matrix. |
| `prMatrix/` | The GitHub-PR overlap matrix (columns = PRs, rows = files). |
| `report/` | `DevActions` — dev-only quick actions. |
| `repo/` | Folder picker + IndexedDB-persisted FSAPI handle + `isomorphic-git` fs adapter. |
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
