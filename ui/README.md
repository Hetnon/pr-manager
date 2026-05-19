# ui

React + TypeScript, bundled by Webpack into `public/app.js`. Entry: `src/app.tsx`.

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

## Dev commands

```powershell
npm run watch      # webpack --watch, rebuilds on save
npm run build      # one-shot production bundle
```

The server pushes a reload event over SSE when `app.js` changes, so the browser
refreshes itself.

## Conventions

- Imports use `.js` extensions even for `.ts`/`.tsx` files (NodeNext-style;
  webpack's `extensionAlias` resolves them).
- Shared types come from `@shared/*` (aliased to `../TypesAndInterfaces`).
- CSS Modules for `*.module.css`; plain `*.css` stays global.
