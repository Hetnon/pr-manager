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
| `workingTreeStatus.ts` | Fast untracked/modified/deleted snapshot. `statusMatrix` can't use git's stat-cache over FSAPI (no inode/ctime) so it re-hashes everything; instead we parse `.git/index` for each file's mtime+size+oid and only hash files whose mtime(s)+size changed — git's `core.checkStat=minimal` shortcut. Runs as the first phase of refresh; surfaces a dirty tree as a warning and blocks fold/dedup |
| `checkLocalConflicts.ts` | For each non-default branch, the set of files changed vs merge-base; derives branch-vs-default and per-file conflict detail |
| `lineLevelConflicts.ts` | Per shared file, a real 3-way merge (`node-diff3`) between each branch pair → `safe`/`identical`/`warning`/`conflict`, plus conflict line ranges and per-branch edit ranges for tooltips. Identical content (same blob oid) is detected up front |
| `conflictCache.ts` | SHA-keyed persistent cache (`.tech_lead/cache.json`) of merge-bases, changed-file sets, pair verdicts (+regions) and per-(branch,file) blob info |
| `LocalBranchesMatrix.tsx` | Matrix view mirroring the GitHub PR matrix — branches as columns, files as rows. Color = 3-way-merge severity; the dot is presence only. Cells whose content is identical to another branch's are tinted blue per-cell |
| `planDedup.ts` | Pure planner: from the per-file identical groups + an ordered branch list, the ordered pairwise dedup options (drop files identical to a later branch from the earlier one) |
| `createDedupBranch.ts` | Object-level git op: build a `‹branch›-dedup` branch from HEAD with chosen files reverted to the merge-base (or deleted), via writeTree/writeCommit/writeRef. Never touches the working tree; leaves the original branch alone |
| `DedupPanel.tsx` | "Reduce redundancy" UI — lists the dedup options and applies the chosen ones |
| `LocalBranchesPanel.tsx` | Container — reads branches on mount, runs conflict check on demand, renders the list, matrix, legend, dedup panel, and the vs-default assessment panel |

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

## Conflict semantics (matrix colors)

A cell's **dot** means only that the branch *touches* the file. The **color**
carries the verdict, computed per shared file by a real 3-way merge:

- **white** — only one branch changes it (safe).
- **blue (`identical`)** — every touching branch has byte-identical content;
  merging one makes the rest no-ops here.
- **yellow (`warning`)** — 2+ branches change it but the changes don't overlap,
  so it 3-way-merges cleanly. Worth a semantic review.
- **red (`conflict`)** — a genuine merge conflict; the tooltip lists which
  branches clash and the base-file line ranges.

A branch is only counted "in conflict" if it participates in a real conflicting
pair — identical/non-overlapping overlaps don't make it unsafe.

## Reducing redundancy (dedup branches)

When branches share byte-identical files, the "Reduce redundancy" panel offers,
for each ordered branch pair (i < j), to drop those identical files from the
earlier branch i — concentrating each file in the highest-ordered branch that
has it. Applying creates `‹branch›-dedup` copies (`createDedupBranch.ts`) where
the chosen files are reverted to the merge-base, so they no longer appear in
that branch's diff vs the default branch — merging the dedup copy won't carry or
re-diff them, and the merge end-state is unchanged. Originals are untouched.

Applying does **not** re-run the analysis — that work was already done. The
report is patched in place (`applyDedupToReport`): each donor's deduped files are
dropped and the affected files' verdicts re-derived from the existing data (a
pure filter — removing a branch can only reduce a conflict). The blue overlaps
collapse instantly. On a later manual refresh, the `others` filter in
`LocalBranchesPanel` analyzes each `‹branch›-dedup` **instead of** its original,
so the deduplicated picture persists.

Both the matrix and the bottom branch list show the **effective** set: once a
`‹branch›-dedup` exists, its original is hidden (you act on the dedup), so you
see N branches, not 2N.

### Push folds the dedup back onto the original name

The dedup commit's parent is the original's HEAD, so the original is a clean
**fast-forward** to it. When you push a `‹branch›-dedup`, `handlePush` first
`foldDedupIntoOriginal` — fast-forwards `‹branch›` to the dedup commit and
deletes the `-dedup` ref — then pushes `‹branch›` and opens the PR from it. End
state: one branch per original, real name, deduplicated content, full history.
The fold refuses (and aborts the push) if the original moved since dedup, so it
never clobbers.

## Pending work

- **Push-on-promote + create-PR endpoint** — server proxies `git push` over HTTP
  so the token stays server-side.
- **Fetch / pull / prune from the UI** — rounds out the local-git ergonomics.
