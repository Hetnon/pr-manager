import { Octokit } from '@octokit/rest';
import type { PR } from '@shared/pr.js';
import { requireParam } from './requireParam/requireParam.js';

/**
 * Fetch open PRs for a repo via the GitHub REST API.
 * The list endpoint doesn't include file lists, so we fan out one
 * `listFiles` call per PR in parallel.
 */
export async function fetchPRs(owner: string, repo: string, token: string): Promise<PR[]> {
    requireParam(owner, 'owner is required');
    requireParam(repo, 'repo is required');
    requireParam(token, 'GitHub token is required');

    const octokit = new Octokit({ auth: token });

    const { data: prs } = await octokit.pulls.list({
        owner,
        repo,
        state: 'open',
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
    });

    const enriched = await Promise.all(
        prs.map(async (pr) => {
            const { data: files } = await octokit.pulls.listFiles({
                owner,
                repo,
                pull_number: pr.number,
                per_page: 100,
            });
            return {
                number: pr.number,
                title: pr.title,
                headRefName: pr.head.ref,
                headSha: pr.head.sha,
                mergeable: 'UNKNOWN',          // computed in the conflicts endpoint, not here
                mergeStateStatus: pr.draft ? 'DRAFT' : 'UNKNOWN',
                files: files.map((f) => ({
                    path: f.filename,
                    additions: f.additions,
                    deletions: f.deletions,
                })),
                createdAt: pr.created_at,
                updatedAt: pr.updated_at,
                author: { login: pr.user?.login ?? '' },
                url: pr.html_url,
            } satisfies PR;
        }),
    );

    return enriched;
}
