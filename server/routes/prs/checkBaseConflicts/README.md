# checkMasterConflicts

`POST /api/master-conflicts`

For a set of PR numbers, returns per-PR mergeability against the default branch + which files master has touched since the PR's base. Drives the "Master Conflict Check" panel in the UI.

## Inputs (JSON body)

- `owner` (required)
- `repo` (required)
- `prNumbers` (required, `number[]`)

## Outputs

`200` — `{ results: Record<prNumber, CheckMasterConflictResult> }`. Per PR the result is either:
- `{ ok: true, defaultBranch, clean, conflicts, touchedByMaster, masterLastTouched }`
- `{ ok: false, error }`

## Conflict detection caveat

GitHub doesn't expose the conflicting file paths directly. When `mergeable === false`, the handler reports the **intersection** of files the PR changed and files master changed since the PR's base as "conflict candidates" — that's a best-effort heuristic, not ground truth.

When `mergeable === true`, the matrix still surfaces "master also touched this file" as a yellow warning chip; the merge is textually clean but may have semantic conflicts worth a human's review.

## Cost note

Each PR triggers ~3 GitHub calls (`repos.get` + `pulls.get` + `repos.compareCommits`) plus one `repos.listCommits` per file in the PR for `masterLastTouched`. Loops are sequential per PR but the file lookups within a PR run in parallel. At large PR counts or large file lists this is the most rate-limit-hungry endpoint.
