# listPrs

`GET /api/prs?owner=<owner>&repo=<repo>`

Returns open PRs for the repo, each enriched with its file list (used by the matrix UI to compute file-overlap).

## Inputs

- `owner` (query, required) — GitHub owner/org.
- `repo` (query, required) — repo name.
- Session: `req.session.userEmail` must exist (`validateUser` enforces).

## Outputs

`200` — `PR[]` (see `TypesAndInterfaces/pr.ts`).
`400` — repo string invalid or no GitHub access (returns `{ error, needsRepo: true }`).
`401` — no stored OAuth token; UI should redirect to re-auth.

## Cost note

The GitHub PR-list endpoint doesn't include file lists, so this handler fans out one `pulls.listFiles` call per PR in parallel. At ≥30 open PRs, watch the rate-limit budget.
