# expressSession

Owns the lifecycle of an authenticated user session.

## Responsibilities

- **`sessionConfig/`** — builds the express-session config (cookie shape, store binding, signing secret).
- **`includeUserInfoToSession/`** — attaches user identity to a fresh session after successful login.
- **`checkUserSession/`** — the UI calls this to ask "am I logged in?" and to receive a fresh CSRF token.
- **`terminateSession/`** — destroys the session record, clears the client cookie, removes the session from the user→sessions map.

## How it works

- Sessions persist to Firestore via `databases/firestore/sessions/sessionStore`.
- Cookie: `httpOnly`, `secure`, `sameSite: 'strict'`, 30-day max-age. Cookie *name* equals `NODE_ENV` so dev and prod sessions don't collide on the same machine.
- On login, `includeUserInfoToSession` regenerates the session ID (defeats fixation), writes `userEmail` / `userType` / `userStatus` onto the session, then records the new session ID in `sessionsMap/<userEmail>` so the rest of the system can fan out updates (e.g. status changes) to every active session for that user.
- Sessions only carry identity — the GitHub OAuth `access_token` lives KMS-encrypted in the user's Firestore document, not in the session.

## Required env

- `SESSION_SECRET` — signs the session cookie.
- `COOKIE_DOMAIN` — cookie domain attribute.
- `NODE_ENV` — used as the cookie name.
