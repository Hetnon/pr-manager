// Run a shell command and resolve { stdout, stderr, code }.
// Never rejects for non-zero exit — callers inspect `code`.

import { exec } from 'node:child_process';

export default function run(cmd, opts = {}) {
  return new Promise((resolve) => {
    exec(cmd, opts, (err, stdout, stderr) => {
      resolve({
        stdout: (stdout || '').toString(),
        stderr: (stderr || '').toString(),
        code: err ? (err.code ?? 1) : 0,
      });
    });
  });
}
