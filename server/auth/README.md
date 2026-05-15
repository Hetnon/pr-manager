# auth

Authentication providers. Each subfolder is one identity source.

## Responsibilities

- **Initiate** a provider's login handshake (redirect URL, scopes, anti-CSRF state).
- **Handle the provider's callback** — verify state, exchange the auth code for credentials, upsert the user, persist credentials, attach identity to a session.
- **Own provider-specific helpers** (state tokens, profile fetching, scope mapping) used only by that provider's flow.

## Layout

```
auth/
└── <provider>/
    ├── README.md      Provider-specific notes (OAuth app setup, scopes, etc.)
    ├── login.ts       POST handler that returns the provider's authorize URL
    ├── callback.ts    GET handler the provider redirects to after the user authorizes
    └── ...            Provider-only helpers (e.g. github/oauthState.ts)
```

`server.ts` mounts each provider as public routes (before CSRF middleware), since
the OAuth round-trip has no session yet.

## Why not under `routes/`?

`routes/` is for endpoint handlers that operate on already-authenticated requests.
Auth is the *origin* of authentication itself — it has its own lifecycle, its own
state mechanics, and it grows independently as new providers are added. Keeping
it top-level mirrors how `expressSession/` lives outside `routes/`.

## Providers

- **`github/`** — GitHub OAuth App; long-lived user tokens with scopes like `repo`, `read:user`, `user:email`.
