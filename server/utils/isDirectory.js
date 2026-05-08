import fs from 'node:fs';

export default function isDirectory(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
