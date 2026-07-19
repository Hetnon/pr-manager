// isomorphic-git's browser ESM build calls `Buffer.from(...)` / `Buffer.isBuffer(...)`
// (76 times) without importing Buffer — it assumes the Node global. Browsers don't
// have it, and Vite has no equivalent of webpack's `ProvidePlugin`, so we install
// the `buffer` npm polyfill on `globalThis` here. This module is imported first in
// app.tsx, so Buffer exists before any isomorphic-git code runs.
import { Buffer } from 'buffer';

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
g.Buffer ??= Buffer;
