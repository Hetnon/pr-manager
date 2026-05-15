# routes/prs

HTTP endpoint handlers for the PR matrix feature — the project's primary user-facing surface.

Every handler runs behind `validateUser` (session required) and reads the caller's GitHub OAuth token from Firestore (KMS-decrypted on demand) before calling GitHub.

## Folders

- **`listPrs/`** — `GET /api/prs?owner=…&repo=…` — list open PRs with file lists for the matrix view.
- **`mergePr/`** — `POST /api/merge-pr` — squash/merge/rebase a PR via the GitHub API.
- **`checkMasterConflicts/`** — `POST /api/master-conflicts` — for a set of PR numbers, return per-PR mergeable state + which files master has also touched since the PR's base.

## Convention

Each subfolder is a single handler:
- `<name>/<name>.ts` exports the handler function.
- `<name>/<name>.test.ts` — unit tests for that handler.
- `<name>/README.md` — what the endpoint does, inputs, outputs, error modes.

When you add a new PR-related endpoint, follow the same pattern and mount it in `server.ts` next to the existing three.

## What lives here vs. `utils/`

- **`routes/prs/<name>/<name>.ts`** owns the HTTP shape: pulling args from query/body, fetching the user's token, returning the response.
- **`utils/{fetchPRs,mergePr,checkMasterConflict,validateRepo}.ts`** own the GitHub API logic — Octokit calls, response shaping, error mapping. Reusable from anywhere, no Express dependency.
