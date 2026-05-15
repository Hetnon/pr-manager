import { Octokit } from '@octokit/rest';

export type ValidateRepoResult =
    | { ok: true; owner: string; repo: string }
    | { ok: false; error: string };

/**
 * Validate an "owner/repo" string by HEAD-ing the repo via the GitHub API
 * using the current user's stored token. Confirms the repo exists AND the
 * user has read access.
 */
export async function validateRepo(repoString: unknown, token: string): Promise<ValidateRepoResult> {
    if (!repoString || typeof repoString !== 'string') {
        return { ok: false, error: 'No repo provided.' };
    }
    const parts = repoString.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { ok: false, error: 'Repo must be in "owner/repo" format' };
    }
    const [owner, repo] = parts;

    const octokit = new Octokit({ auth: token });
    try {
        await octokit.repos.get({ owner, repo });
        return { ok: true, owner, repo };
    } catch (e) {
        const error = e as { status?: number; message?: string };
        if (error.status === 404) {
            return { ok: false, error: `Repo "${repoString}" not found or no access.` };
        }
        return { ok: false, error: error.message ?? `GitHub error (${error.status ?? '?'})` };
    }
}
