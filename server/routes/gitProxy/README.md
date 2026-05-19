# routes/gitProxy

Smart-HTTP git protocol proxy. Forwards the browser-side `isomorphic-git`
client to `https://github.com/<owner>/<repo>.git/...` with the user's OAuth
token attached server-side. The token never leaves the server.

## Endpoints

| Method + path | Purpose |
|---|---|
| `GET  /api/git-proxy/:owner/:repo/info/refs?service=git-receive-pack` | Ref discovery — first step of push. Returns the remote ref list signed by GitHub. |
| `POST /api/git-proxy/:owner/:repo/:service` | Receives the binary pack data (`service` ∈ `git-receive-pack`, `git-upload-pack`) and forwards it. |

Both routes require an authenticated session (`validateUser`). The POST mounts
`bodyParser.raw({ type: '*/*', limit: '50mb' })` on itself so the global JSON
parser doesn't touch the binary body.

## Security

- **Target allowlist**: only `git-receive-pack` and `git-upload-pack` services are
  forwarded; anything else returns 400. Target host is hard-coded to
  `https://github.com/...` — no user-controlled URL.
- **Auth**: session-gated. The user's OAuth token is fetched from Firestore
  (KMS-decrypted on demand) and added as `Authorization: Bearer`.
- **CSRF**: GET is exempt (safe method); the POST goes through
  `syncCSRFProtection` like every other state-changing route. The browser
  adapter (`ui/src/repo/gitHttpAdapter.ts`) injects `CSRF-Token` for non-GETs.

## Why a proxy instead of pushing from the browser

GitHub OAuth tokens are KMS-encrypted at rest and must not enter the browser
(per the project's threat model). The browser computes the push (pack file,
ref updates) locally with `isomorphic-git`, then routes its HTTP calls through
this proxy. The proxy is the only place that touches the token.
