# TypesAndInterfaces

The single source of truth for type definitions that cross the server/UI
boundary, or that would otherwise be duplicated between them.

Imported as `@shared/<name>.js` from both sides (path mapped in
`server/tsconfig.json` and `ui/tsconfig.json`; webpack alias in
`ui/webpack.config.cjs`).

## What goes here

- API request/response shapes (`pr.ts`, `merge.ts`, `conflicts.ts`, `session.ts`).
- Domain types either side reads or writes (`user.ts`).
- Cross-cutting infrastructure types used in more than one file (`error.ts`,
  `config.ts`).

## What does NOT go here

- React component `Props` — they're local to the component file.
- Internal helper aliases (`type Fs = ReturnType<typeof makeFsApiFs>` etc.) —
  keep them next to the code that uses them.
- Third-party API response shapes that only one file unwraps (e.g. the GitHub
  OAuth callback's intermediate response types).
- UI-only visualisation types (matrix internals, cell states) — they live with
  the components.

## Convention

One file per domain. Use `import type` everywhere — these files contain only
types, so the imports must elide.
