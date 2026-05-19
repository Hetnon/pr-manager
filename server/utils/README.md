# utils

Framework-free helpers — no Express, no Firestore admin, no React. Callable
from any layer.

## What's here

| File / folder | Purpose |
|---|---|
| `requireParam/` | `requireParam` / `throwValidationError` — common pattern for "missing arg → throw 400" wrapped in an `AppError`. |
| `validateRepo.ts` | Probes a GitHub repo via Octokit (404 / 403 / ok) and normalises owner/repo casing. |
| `fetchPRs.ts` | Lists open PRs + their files for the matrix. Fans out one `listFiles` call per PR. |
| `mergePr.ts` | Calls the GitHub merge endpoint with the chosen strategy. |
| `checkMasterConflict.ts` | Computes per-PR conflict candidates by intersecting PR files with files master changed since the PR's base. |

## Convention

If a function needs `req`/`res` or a Firestore handle, it belongs in `routes/`
or `databases/`, not here. `utils/` is the layer the others *call into*.
