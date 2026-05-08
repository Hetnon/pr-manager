import fs from 'node:fs';
import path from 'node:path';
import run from './run.js';
import isDirectory from './isDirectory.js';

export default async function validateRepo(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') {
    return { ok: false, error: 'No path provided.' };
  }
  const abs = path.resolve(repoPath);
  if (!fs.existsSync(abs)) {
    return { ok: false, error: `Path does not exist: ${abs}` };
  }
  if (!isDirectory(abs)) {
    return { ok: false, error: `Path is not a directory: ${abs}` };
  }
  const { stdout, code } = await run('git rev-parse --is-inside-work-tree', { cwd: abs });
  if (code !== 0 || stdout.trim() !== 'true') {
    return { ok: false, error: `Not a git repository: ${abs}` };
  }
  return { ok: true, repoPath: abs };
}
