import { Octokit } from '@octokit/rest';
import type { ClosePrResult } from '@shared/git.js';
import { requireParam } from './requireParam/requireParam.js';

// Closes a pull request without merging it. GitHub's API has no "delete PR";
// setting state=closed is the equivalent (and is reversible — it can be reopened
// on GitHub). Owner/repo are assumed already validated by the caller.
export async function closePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    token: string,
): Promise<ClosePrResult> {
    requireParam(owner, 'owner is required');
    requireParam(repo, 'repo is required');
    requireParam(prNumber, 'prNumber is required', 'number');
    requireParam(token, 'GitHub token is required');

    const octokit = new Octokit({ auth: token });
    try {
        await octokit.pulls.update({ owner, repo, pull_number: prNumber, state: 'closed' });
        return { ok: true, number: prNumber };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}
