// Dry-run merge a PR against the local default branch (master/main) to see if
// it would conflict. Uses `git merge-tree --write-tree --name-only` (Git 2.38+),
// which writes the merged tree to the object DB and reports any conflicting
// paths to stdout. No working-tree changes; only `git fetch` for the PR ref
// (updates remote-tracking refs, doesn't touch local branches).

import run from './run.js';

export default async function checkMasterConflict(repoPath, prNumber) {
  // 1. Default branch: read origin/HEAD (e.g. "origin/main")
  const head = await run('git symbolic-ref refs/remotes/origin/HEAD', { cwd: repoPath });
  if (head.code !== 0) {
    return { ok: false, error: head.stderr.trim() || 'Could not detect default branch. Run: git remote set-head origin -a' };
  }
  const defaultRef = head.stdout.trim().replace(/^refs\/remotes\//, '');

  // 2. Fetch the PR's HEAD ref (GitHub exposes refs/pull/<n>/head on origin)
  const fetched = await run(`git fetch origin pull/${prNumber}/head`, { cwd: repoPath });
  if (fetched.code !== 0) {
    return { ok: false, error: fetched.stderr.trim() || `git fetch failed for PR #${prNumber}` };
  }

  // 3. Merge base
  const base = await run(`git merge-base ${defaultRef} FETCH_HEAD`, { cwd: repoPath });
  if (base.code !== 0) {
    return { ok: false, error: base.stderr.trim() || 'git merge-base failed' };
  }
  const baseSha = base.stdout.trim();

  // 4. merge-tree: exit 0 = clean, exit 1 = conflicts.
  // stdout layout: first line is the resulting tree SHA, subsequent lines are conflict paths.
  const merge = await run(
    `git merge-tree --write-tree --name-only --merge-base=${baseSha} ${defaultRef} FETCH_HEAD`,
    { cwd: repoPath }
  );

  if (merge.code !== 0 && merge.code !== 1) {
    // 0 = clean, 1 = conflicts — anything else is a real failure
    return { ok: false, error: merge.stderr.trim() || `git merge-tree exit ${merge.code}` };
  }

  const lines = merge.stdout.trim().split('\n').filter(Boolean);
  const conflicts = lines.slice(1);

  // 5. Files master has changed since the merge base — useful as a warning
  // signal even when the merge is clean (semantic conflicts don't show up
  // as textual conflicts).
  const masterDiff = await run(
    `git diff --name-only ${baseSha} ${defaultRef}`,
    { cwd: repoPath }
  );
  const touchedByMaster = masterDiff.code === 0
    ? masterDiff.stdout.trim().split('\n').filter(Boolean)
    : [];

  // 6. For each file in the PR, find master's most recent commit touching it
  // (regardless of merge base). Surfaces "master last touched X 2d ago" as a
  // heads-up chip in the matrix, even when there's no current conflict.
  const prDiff = await run(`git diff --name-only ${baseSha} FETCH_HEAD`, { cwd: repoPath });
  const prFiles = prDiff.code === 0 ? prDiff.stdout.trim().split('\n').filter(Boolean) : [];

  const masterLastTouched = {};
  for (const file of prFiles) {
    const log = await run(
      `git log -1 --format=%H%x09%aI%x09%s ${defaultRef} -- "${file.replace(/"/g, '\\"')}"`,
      { cwd: repoPath }
    );
    if (log.code === 0 && log.stdout.trim()) {
      const parts = log.stdout.trim().split('\t');
      masterLastTouched[file] = {
        sha: parts[0],
        date: parts[1],
        subject: parts.slice(2).join('\t'),
      };
    }
  }

  return {
    ok: true,
    defaultBranch: defaultRef,
    clean: conflicts.length === 0,
    conflicts,
    touchedByMaster,
    masterLastTouched,
  };
}
