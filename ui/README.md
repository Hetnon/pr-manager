# ui

React + TypeScript, bundled by Vite. Entry: `src/app.tsx` (loaded from the root
`index.html`). Build output lands in `dist/` (gitignored); `public/` holds static
assets that ship verbatim (e.g. `styles.css`, favicons), served at the site root.

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
| `public/` | Static assets copied to `dist/` as-is and served at `/` (e.g. `styles.css`). |
| `index.html` | App entry document Vite serves and transforms. References `/src/app.tsx`. |
| `dist/` | Vite output (gitignored). Produced by `npm run build`; in dev it lives in memory. |

## Dev commands

```powershell
npm run dev        # vite dev server at https://localhost:7654 (bundle served from memory)
npm run build      # one-shot production build into dist/
npm run build:dev  # dev-mode build to dist/ (rarely needed; use `dev` for iteration)
npm run typecheck  # tsc --noEmit
```

`dev` reuses the API server's HTTPS certs from
`../server/keys/security_certificate/` when they exist, otherwise falls back to
HTTP. HMR is intentionally off (`server.hmr: false` in `vite.config.ts`): the
page only updates on a manual reload, so whatever's on screen — used as a working
reference — is never lost. No disk writes happen during dev.

## Conventions

- Imports use `.js` extensions even for `.ts`/`.tsx` files (NodeNext-style, same
  as the server). Vite has no `resolve.extensionAlias`, so a small `resolveId`
  plugin in `vite.config.ts` strips the `.js` and lets the default resolver
  re-add `.ts`/`.tsx`.
- Shared types come from `@shared/*` (aliased to `../TypesAndInterfaces`).
- CSS Modules for `*.module.css` (`localsConvention: 'camelCaseOnly'`, `composes`
  supported); plain `*.css` stays global. Files in `public/` are served at the
  site root and referenced from `index.html` with absolute paths (e.g.
  `/styles.css`) — use this lane for global stylesheets and assets.
- `__API_BASE_URL__` is replaced at build time by Vite's `define` (dev default
  `https://localhost:3030`, prod default same-origin); override with the
  `API_BASE_URL` env var.
- The `Buffer` global is installed by `src/bufferPolyfill.ts` (imported first in
  `src/app.tsx`) because `isomorphic-git`'s browser ESM build uses it without an
  explicit import. Vite has no equivalent of webpack's `ProvidePlugin`.
