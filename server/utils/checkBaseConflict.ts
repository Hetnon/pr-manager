import { Octokit } from '@octokit/rest';
import type { CheckBaseConflictResult, BaseTouch } from '@shared/conflicts.js';
import { requireParam } from './requireParam/requireParam.js';

/**
 * Check whether a PR conflicts with the base (default) branch and surface
 * "the base branch also touched these files" warnings.
 *
 * GitHub computes the mergeable bit asynchronously, so the first GET on a
 * just-opened PR can return mergeable=null. We retry once with a short wait.
 * GitHub does not expose conflicting file paths directly — we approximate
 * "conflict candidates" as the intersection of files the PR changed and
 * files the base branch changed since the PR branched off.
 */
export async function checkBaseConflict(
    owner: string,
    repo: string,
    prNumber: number,
    token: string,
): Promise<CheckBaseConflictResult> {
    requireParam(owner, 'owner is required');
    requireParam(repo, 'repo is required');
    requireParam(prNumber, 'prNumber is required', 'number');
    requireParam(token, 'GitHub token is required');

    const octokit = new Octokit({ auth: token });

    try {
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        const defaultBranch = repoData.default_branch;

        let pr = (await octokit.pulls.get({ owner, repo, pull_number: prNumber })).data;
        if (pr.mergeable === null) {
            await new Promise((r) => setTimeout(r, 1500));
            pr = (await octokit.pulls.get({ owner, repo, pull_number: prNumber })).data;
        }

        const baseSha = pr.base.sha;

        const { data: comp } = await octokit.repos.compareCommits({
            owner,
            repo,
            base: baseSha,
            head: defaultBranch,
        });
        const touchedByBase = (comp.files ?? []).map((f) => f.filename);

        const { data: prFiles } = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 100,
        });
        const prFilenames = prFiles.map((f) => f.filename);

        const baseSet = new Set(touchedByBase);
        const conflictCandidates = prFilenames.filter((f) => baseSet.has(f));
        const clean = pr.mergeable === true;
        const conflicts = clean ? [] : conflictCandidates;

        const baseLastTouched: Record<string, BaseTouch> = {};
        await Promise.all(
            prFilenames.map(async (file) => {
                try {
                    const { data: commits } = await octokit.repos.listCommits({
                        owner,
                        repo,
                        path: file,
                        sha: defaultBranch,
                        per_page: 1,
                    });
                    if (commits[0]) {
                        baseLastTouched[file] = {
                            sha: commits[0].sha,
                            date: commits[0].commit.author?.date ?? '',
                            subject: commits[0].commit.message.split('\n')[0],
                        };
                    }
                } catch {
                    // per-file errors are non-fatal
                }
            }),
        );

        return {
            ok: true,
            defaultBranch,
            clean,
            conflicts,
            touchedByBase,
            baseLastTouched,
        };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}
