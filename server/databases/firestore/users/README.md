# firestore/users

The `users` collection. Document ID = `userEmail` (set on first GitHub login).

## Schema

See `userSchema.ts` for the canonical field list. Highlights:

- `userEmail`, `githubLogin`, `githubId`, `name`, `avatarUrl` — identity.
- `userStatus` (`active` | `suspended` | …), `userType` (`user` | `admin` | `master-admin`).
- `encryptedToken`, `encryptedDek`, `kmsKeyName`, `tokenScopes` — KMS-envelope-encrypted
  GitHub OAuth token. Never read directly — go through `tokens/`.

## Operations

| Folder / file | Purpose |
|---|---|
| `createUser/` | Insert a new user doc on first OAuth login. |
| `deleteUser/` | Remove a user doc (admin action). |
| `getUserByGithubId/` | Lookup by stable GitHub numeric id (handles email changes). |
| `getUsersList/` | Admin paged list. |
| `updateUserFields/` | Generic field update (supports nested merge). |
| `getUserCollectionDocument/` | Internal helper — generic doc fetch by id. |
| `tokens/` | KMS-encrypted OAuth token store/get/clear — the only files that touch the encrypted columns. |
| `userMethodsForTesting.ts` | Jest fixture seed/cleanup. |
| `userMethods.ts` | Barrel — what the firestore provider exposes. |
| `userSchema.ts` | Reference schema (not runtime-validated, doc-only). |
