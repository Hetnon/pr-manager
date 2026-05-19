# routes/prs/createPr

`POST /api/create-pr` — opens a pull request on GitHub via Octokit.

## Request body

```ts
{
    owner: string;        // repo owner
    repo: string;         // repo name
    head: string;         // branch with the new commits (must already be pushed)
    base: string;         // target branch (usually master/main)
    title: string;
    body?: string;        // PR description (markdown)
    draft?: boolean;
}
```

See `TypesAndInterfaces/git.ts` (`CreatePrPayload`).

## Response

`201 Created` with `{ number: number; url: string }` — the PR number and its
GitHub URL.

## Errors

- `400` — missing/invalid params, or the repo failed `validateRepo` (no access).
- `401` — no OAuth token in the user's Firestore record.
- `4xx`/`5xx` from GitHub — bubbled through the central error handler with the
  Octokit error message.

## Pairs with

- `gitProxy/` — the user pushes their local branch through that proxy, then
  calls this endpoint to open the PR.
