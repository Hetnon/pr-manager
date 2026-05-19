import { Octokit } from '@octokit/rest';
import type { CreatePrPayload, CreatePrResult } from '@shared/git.js';
import { requireParam } from './requireParam/requireParam.js';

// Thin Octokit wrapper. Owner/repo are assumed already validated by the caller
// via validateRepo — we don't re-check here.
export async function createPullRequest(payload: CreatePrPayload, token: string): Promise<CreatePrResult> {
    requireParam(payload.owner, 'owner is required');
    requireParam(payload.repo, 'repo is required');
    requireParam(payload.head, 'head branch is required');
    requireParam(payload.base, 'base branch is required');
    requireParam(payload.title, 'title is required');
    requireParam(token, 'GitHub token is required');

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.pulls.create({
        owner: payload.owner,
        repo: payload.repo,
        head: payload.head,
        base: payload.base,
        title: payload.title,
        body: payload.body,
        draft: payload.draft,
    });
    return { number: data.number, url: data.html_url };
}
