# mergePr

`POST /api/merge-pr`

Merges a PR via the GitHub API on the caller's behalf.

## Inputs (JSON body)

- `owner` (required)
- `repo` (required)
- `prNumber` (required, number)
- `strategy` — `'squash' | 'merge' | 'rebase'`, defaults to `'squash'`.

## Outputs

`200` — `{ ok: true, defaultBranch, steps }` on success.
`500` — `{ ok: false, error }` on GitHub-side failure (PR not mergeable, missing permissions, branch protection, etc.).
`401` — no stored OAuth token.

## Local-mode preflight states (legacy)

The shared `MergePrResult` type still carries `preflight: 'wrong-branch' | 'dirty-tree'` cases — those only fire in the abandoned local-shell-git mode. In API mode this handler never returns them; GitHub itself enforces branch protection / required checks.
