import run from './run.js';

const GH_CMD = 'gh pr list --state open --json number,title,headRefName,mergeable,mergeStateStatus,files,createdAt,updatedAt,author,url';

export default async function fetchPRs(repoPath) {
  const { stdout, stderr, code } = await run(GH_CMD, { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 });
  if (code !== 0) throw new Error(stderr.trim() || `gh exited with code ${code}`);
  return JSON.parse(stdout);
}
