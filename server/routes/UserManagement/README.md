# routes/UserManagement

Admin-only user CRUD. Every endpoint sits behind `validateAdmin` middleware
(see `validationMiddleware/`).

## Endpoints

| Folder | Method + path | Purpose |
|---|---|---|
| `getUsersList/` | `GET /api/users` | Paged listing (admin dashboard). Strips encrypted token fields server-side. |
| `changeUserStatus/` | `POST /api/users/status` | Set `userStatus` (suspend / reactivate). Fans out via `updateUserSessions` so every active session of the target user learns of the change. |
| `deleteUser/` | `POST /api/users/delete` | Remove the user doc entirely. |

## Convention

Same as `routes/prs/` and `routes/Observability/`: one folder per endpoint,
handler in `<name>/<name>.ts`, jest test next door.
