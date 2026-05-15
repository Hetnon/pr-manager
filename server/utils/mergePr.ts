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
        return {
            ok: true,
            defaultBranch,
            steps: [
                `Merged PR #${prNumber} via GitHub API (${strategy})`,
                `Merge commit SHA: ${data.sha}`,
            ],
        };
    } catch (e) {
        const error = e as { status?: number; message?: string };
        return { ok: false, error: error.message ?? `Merge failed (status ${error.status ?? '?'})` };
    }
}
