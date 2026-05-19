import { Octokit } from '@octokit/rest';
import type { MergeStrategy, MergePrResult } from '@shared/merge.js';
import { requireParam } from './requireParam/requireParam.js';

/**
 * Merge a PR via the GitHub REST API.
 * The local-mode preflight states (wrong-branch / dirty-tree) don't apply
 * to API-driven merges — GitHub itself enforces protected-branch rules
 * and returns 405 if the PR isn't mergeable.
 */
export async function mergePr(
    owner: string,
    repo: string,
    prNumber: number,
    strategy: MergeStrategy = 'squash',
    token: string,
    deleteBranch = false,
): Promise<MergePrResult> {
    requireParam(owner, 'owner is required');
    requireParam(repo, 'repo is required');
    requireParam(prNumber, 'prNumber is required', 'number');
    requireParam(token, 'GitHub token is required');

    const octokit = new Octokit({ auth: token });

    let defaultBranch = '';
    try {
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        defaultBranch = repoData.default_branch;
    } catch {
        // Non-fatal; merge can proceed without knowing the default branch name.
    }

    try {
        const { data } = await octokit.pulls.merge({
            owner,
            repo,
            pull_number: prNumber,
            merge_method: strategy,
        });
        const steps: string[] = [
            `Merged PR #${prNumber} via GitHub API (${strategy})`,
            `Merge commit SHA: ${data.sha}`,
        ];

        if (!deleteBranch) {
            return { ok: true, defaultBranch, steps };
        }

        // Best-effort branch deletion. Skip for forks (can't delete from base
        // repo). Failures don't fail the overall merge — surface as a warning.
        try {
            const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
            if (pr.head.repo?.full_name !== `${owner}/${repo}`) {
                return {
                    ok: true, defaultBranch, steps,
                    branchDeleted: false,
                    branchDeleteError: `Skipped — branch is in a fork (${pr.head.repo?.full_name ?? 'unknown'})`,
                };
            }
            await octokit.git.deleteRef({ owner, repo, ref: `heads/${pr.head.ref}` });
            steps.push(`Deleted branch ${pr.head.ref}`);
            return { ok: true, defaultBranch, steps, branchDeleted: true };
        } catch (deleteErr) {
            const e = deleteErr as { status?: number; message?: string };
            return {
                ok: true, defaultBranch, steps,
                branchDeleted: false,
                branchDeleteError: e.message ?? `Delete failed (status ${e.status ?? '?'})`,
            };
        }
    } catch (e) {
        const error = e as { status?: number; message?: string };
        return { ok: false, error: error.message ?? `Merge failed (status ${error.status ?? '?'})` };
    }
}
