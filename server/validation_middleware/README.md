# validation_middleware

Express middleware that gates routes behind auth and CSRF checks.

## Responsibilities

- **`validateUser/validateUser.ts`** — requires `req.session.userEmail` and `userStatus === 'active'`. 401 if no session, 403 if not active.
- **`validateUser/validateAdmin.ts`** — additionally requires `userType ∈ {admin, master-admin}`. 403 otherwise.
- **`csrfProtection/`** — synchronizer-token CSRF protection via `csrf-sync`, bound to the session.

## How it works

- `initializeCSRF()` runs once during server boot. It configures `csrf-sync` to read the token from the `CSRF-Token` request header (with `_csrf` body field as fallback).
- `syncCSRFProtection` is mounted on `/api` *after* session middleware and *after* public auth routes — so the OAuth flow and `check-user-session` are exempt.
- `CSRFTokenGenerator(req)` mints a fresh token for the current session. The UI receives one in the `/api/check-user-session` response and echoes it back in the `CSRF-Token` header on every state-changing request.
- All three middlewares forward typed errors (with `statusCode`) to the central error handler — they never write to the response themselves.

## Failure codes

- **401** — no session / no `userEmail` on the session.
- **403** — session exists but `userStatus !== 'active'`, `userType` not allowed, or CSRF token missing/invalid.
