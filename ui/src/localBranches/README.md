# Local-git layer

This folder, together with `../repo/`, implements the browser-side local-git work
for the tech-lead tool. Two layers:

- `../repo/` — pick the user's local repo folder, persist the handle, and expose
  a node-style `fs` adapter over the File System Access API.
- `./` (this folder) — read branches, compute ahead/behind and conflicts against
  the default branch, render the branch matrix.

## What lives here

| File | Responsibility |
|---|---|
| `readLocalRepo.ts` | List branches, resolve HEADs, compute ahead/behind vs default (walk capped at 500 commits) |
| `checkLocalConflicts.ts` | For each non-default branch, the set of files changed vs merge-base; derives branch-vs-default and pairwise overlaps |
| `LocalBranchesMatrix.tsx` | Matrix view mirroring the GitHub PR matrix — branches as columns, files as rows |
| `LocalBranchesPanel.tsx` | Container — reads branches on mount, runs conflict check on demand, renders the table + matrix |

And in `../repo/`:

| File | Responsibility |
|---|---|
| `pickRepoFolder.ts` | `showDirectoryPicker()`, parse `.git/config` for the GitHub remote |
| `repoFolderStorage.ts` | Persist the `FileSystemDirectoryHandle` in IndexedDB so reload reattaches |
| `useRepoSelection.ts` | React hook bridging localStorage (owner/name) + IDB (handle) |
| `RepoSelector.tsx` | The folder-picker UI |
| `fsApiAdapter.ts` | node-style `fs.promises` over FSAPI — what `isomorphic-git` calls into |

## What the spike proved (now deleted)

A throwaway spike (`gitSpike.ts` + `GitSpikePanel.tsx`) verified the architecture
end-to-end before we built the real feature. Findings still relevant:

- `isomorphic-git`'s browser ESM build uses `Buffer.from(...)` 76 times without
  importing it — `Buffer` is assumed global. Browsers don't have it, so any
  pack-file read failed silently (`fs.read` wrapper swallows the
  `ReferenceError` and returns `null`; caller crashes on `null.slice()`). Fix:
  the `buffer` npm polyfill exposed as a global via Webpack's `ProvidePlugin`
  (see `ui/webpack.config.cjs`).
- Pack-file reads via the FSAPI adapter work for all `.idx` files in a real
  multi-pack repo (tested with 4 packs, 197k / 8k / 20k / 18k bytes).
- `git.findMergeBase`, `git.log`, `git.walk` all work over the FSAPI adapter.
- `git.merge({ dryRun: true })` works for fast-forward merges but throws
  `MergeNotSupportedError` for non-FF — so we can't lean on it for the
  clean/dirty bit on diverged branches. We compute conflicts ourselves via
  tree-diff intersections.

## Architecture decision: where does git compute run?

Local-first. The browser does all read-only git work (list branches, log, diff,
conflict detection) against the user's local repo via FSAPI + `isomorphic-git`.
The server only mediates GitHub API calls (PR list, merge) and — once Task #4
ships — proxies authenticated `git push` so the user's OAuth token never enters
the browser.

## Pending work

- **Line-level overlap** for the matrix view (red = same lines, yellow = same
  file different lines). Needs a JS diff library and per-blob hunk computation.
- **Push-on-promote + create-PR endpoint** — server proxies `git push` over HTTP
  so the token stays server-side.
- **Fetch / pull / prune from the UI** — rounds out the local-git ergonomics.
