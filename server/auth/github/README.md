# auth/github

GitHub OAuth App flow.

## Files

- **`login.ts`** — `githubLogin`, handler for `POST /api/auth/github/login`. Generates an HMAC-signed `state`, builds the GitHub authorize URL, returns it to the UI for redirect.
- **`callback.ts`** — `githubCallback`, handler for `GET /api/auth/github/callback`. Verifies the `state`, exchanges the `code` for an access token, fetches the user profile (+ primary email if private), upserts the user in Firestore, KMS-encrypts and stores the token, then sets the session and redirects back to the UI.
- **`oauthState.ts`** — stateless OAuth state token (16-byte nonce + timestamp + HMAC-SHA256, base64url-encoded; 10-minute TTL). Used by both `login.ts` and `callback.ts`.

## Why stateless state?

GitHub's redirect back to `/callback` is a cross-site top-level navigation from `github.com` → our API. A session-cookie-backed state would require relaxing `sameSite` from the template's `strict`. Self-verifying state avoids touching the cookie config: the token verifies itself when it comes back, no server-side storage required.

## Required env

| Variable | Where set | Purpose |
|---|---|---|
| `GITHUB_CLIENT_ID` | OAuth App | Identifies the app to GitHub. |
| `GITHUB_CLIENT_SECRET` | OAuth App | Authenticates the token exchange. |
| `GITHUB_REDIRECT_URI` | OAuth App | Must match the callback URL registered on the OAuth App. |
| `GITHUB_OAUTH_SCOPES` | Defaults to `repo read:user user:email` | OAuth scopes requested. |
| `POST_LOGIN_REDIRECT` | Defaults to `/` | Where to send the browser after login completes. |
| `SESSION_SECRET` | — | Used to sign the OAuth state HMAC (separate from the session cookie). |
| `KMS_KEY_NAME` | — | Used by the token-storage path (`databases/firestore/users/tokens/`). |

## OAuth App setup

1. github.com/settings/developers → New OAuth App.
2. Authorization callback URL — register **both** the dev and prod URLs:
   - Dev: `https://localhost:3030/api/auth/github/callback`
   - Prod: `https://api-dot-<project>.<region>.r.appspot.com/api/auth/github/callback`
3. Paste the client ID + secret into `scripts/gcp-bootstrap.js --github-client-id=... --github-client-secret=...`.
