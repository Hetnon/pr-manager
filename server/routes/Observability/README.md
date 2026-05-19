# routes/Observability

Endpoints + the central Express error handler. Anything the system logs about
itself flows through here.

## Endpoints

| Folder | Method + path | Purpose |
|---|---|---|
| `logError/` | `POST /api/log-error` | UI-side errors caught by the React error boundary, posted up for persistence. |
| `logBrowserInfo/` | `POST /api/log-browser-info` | First-load fingerprint (browser, locale, screen) tied to the session. |
| `getErrorLogList/` | `GET /api/error-logs` | Admin-only — paged read of the error collection. |
| `errorHandler/` | (not a route) Express error-handler middleware mounted last. Persists the error via `saveErrorsToDB` and shapes the response. |

## Storage

All three persist via `databases/firestore/observability/` —
`errorLogs/` and `browserInfo/` subcollections.

## Convention

Same as `routes/prs/`: `<name>/<name>.ts` + `<name>.test.ts` per endpoint.
