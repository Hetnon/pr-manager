// One-shot "merge a clean PR + sync local refs" helper.
// Preflight: must be on the default branch with a clean working tree —
// otherwise we refuse and return a structured reason for the UI to surface.

import type { MergeStrategy, MergePrResult } from '@shared/merge.js';
import run from './run.js';

const STRATEGY_FLAGS: Record<MergeStrategy, string> = {
  merge: '--merge',
  squash: '--squash',
  rebase: '--rebase',
};

async function getCurrentBranch(repoPath: string): Promise<string | null> {
  const r = await run('git branch --show-current', { cwd: repoPath });
  return r.code === 0 ? r.stdout.trim() : null;
}

async function getDefaultBranch(repoPath: string): Promise<string | null> {
  const r = await run('git symbolic-ref refs/remotes/origin/HEAD', { cwd: repoPath });
  if (r.code !== 0) return null;
  return r.stdout.trim().replace(/^refs\/remotes\/origin\//, '');
}

async function isWorkingTreeClean(repoPath: string): Promise<boolean> {
  const r = await run('git status --porcelain', { cwd: repoPath });
  return r.code === 0 && r.stdout.trim() === '';
}

export default async function mergePr(
  repoPath: string,
  prNumber: number | string,
  strategy: MergeStrategy = 'squash',
): Promise<MergePrResult> {
  const flag = STRATEGY_FLAGS[strategy] || STRATEGY_FLAGS.squash;

  const defaultBranch = await getDefaultBranch(repoPath);
  if (!defaultBranch) {
    return { ok: false, error: 'Could not detect default branch. Run: git remote set-head origin -a' };
  }
  const currentBranch = await getCurrentBranch(repoPath);
  if (currentBranch !== defaultBranch) {
    return { ok: false, preflight: 'wrong-branch', currentBranch, defaultBranch };
  }
  if (!(await isWorkingTreeClean(repoPath))) {
    return { ok: false, preflight: 'dirty-tree', defaultBranch };
  }

  // 1. Merge via GitHub API
  const merge = await run(`gh pr merge ${prNumber} ${flag} --delete-branch`, { cwd: repoPath });
  if (merge.code !== 0) {
    return { ok: false, error: (merge.stderr || merge.stdout).trim() || `gh pr merge exited ${merge.code}` };
  }

  // 2. Sync remote tracking refs
  const fetched = await run('git fetch origin --prune', { cwd: repoPath });

  // 3. Fast-forward local default branch
  const pulled = await run('git pull --ff-only', { cwd: repoPath });

  return {
    ok: true,
    defaultBranch,
    steps: [
      `Merged PR #${prNumber} on origin via gh pr merge ${flag} --delete-branch`,
      fetched.code === 0
        ? 'git fetch origin --prune — synced remote refs, removed merged branch ref'
        : `git fetch failed: ${fetched.stderr.trim()}`,
      pulled.code === 0
        ? `git pull --ff-only — fast-forwarded local ${defaultBranch}`
        : `git pull failed: ${pulled.stderr.trim()}`,
    ],
  };
}
