// Run a shell command and resolve { stdout, stderr, code }.
// Never rejects for non-zero exit — callers inspect `code`.

import { exec, type ExecOptions } from 'node:child_process';

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export default function run(cmd: string, opts: ExecOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    exec(cmd, opts, (err, stdout, stderr) => {
      resolve({
        stdout: (stdout || '').toString(),
        stderr: (stderr || '').toString(),
        code: err ? ((err as NodeJS.ErrnoException).code as unknown as number ?? 1) : 0,
      });
    });
  });
}
