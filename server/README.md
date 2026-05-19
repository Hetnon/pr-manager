# server

Node/Express. Entry point: `server.ts`.

## Layout

| Folder | What it does |
|---|---|
| `auth/` | GitHub OAuth flow (`/api/auth/github/*`). See `auth/README.md`. |
| `databases/` | DB abstraction (currently Firestore only). See `databases/README.md`. |
| `expressSession/` | Session lifecycle on top of `express-session`. See `expressSession/README.md`. |
| `infrastructure/` | KMS, Secret Manager, anything talking to cloud infra. |
| `routes/` | HTTP endpoint handlers. Sub-grouped by feature area (`prs/`, `Observability/`, `UserManagement/`). |
| `types/` | Ambient type augmentations (`express-session.d.ts` adds `req.session` fields). |
| `utils/` | Reusable, framework-free logic (Octokit calls, validation helpers). See `utils/README.md`. |
| `validationMiddleware/` | Auth + CSRF middleware mounted on `/api`. See `validationMiddleware/README.md`. |

## Conventions

- Each handler/operation lives in its own folder: `area/operation/operation.ts`
  + `operation.test.ts`. The colocation is intentional — a unit and its test
  travel together.
- Routes own HTTP shape; `utils/` owns the business logic — so logic is
  callable without Express.
- Errors thrown with a `statusCode` propagate to the central handler in
  `routes/Observability/errorHandler/`.

## Dev commands

```powershell
npm start          # tsx + node, HTTPS on 3030
npm test           # jest
```
