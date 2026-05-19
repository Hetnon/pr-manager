# databases

A thin provider-routing layer so the rest of the server doesn't know which DB
backs a given method.

## Entry point

`databases.ts` — exports method shims. Each shim dispatches to a registered
provider via the `routing: Record<methodName, dbName>` table.

```
routes/* → databases.ts → providers[dbName][methodName] → actual implementation
```

Today there's one provider: `firestore`. Adding another means dropping a
`<dbName>/<dbName>Methods.ts` next to `firestore/` and listing its methods in
`routing`. No call-site changes needed.

## Provider barrel convention

`databases.ts` loads providers dynamically via `./${db}/${db}Methods.js`. So
each provider folder must expose a `<dbName>Methods.ts` (and a `<dbName>TestSetup.ts`
for jest fixtures). The same naming flows down — `users/userMethods.ts`,
`sessions/sessionMethods.ts` — so the dispatcher can enumerate predictably.

## Firestore layout

`firestore/`
- `firebaseApis.ts` — admin SDK init, collection registry, environment routing
  (dev → emulator, prod → KMS-fetched service account).
- `firestoreMethods.ts` — barrel exposing all methods (merged from per-entity
  barrels).
- `firestoreTestSetup.ts` — jest fixtures (uses the `*MethodsForTesting.ts`
  files next to each entity).
- `setupAndRun/` — emulator launcher.
- `<entity>/` — one folder per collection family: `users/`, `sessions/`,
  `observability/`. Each has its own `<entity>Methods.ts` barrel and one
  operation per subfolder.
