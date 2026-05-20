import { Octokit } from '@octokit/rest';
import { requireParam } from './requireParam/requireParam.js';

// Thin Octokit wrapper. The caller is expected to have already validated the
// repo via validateRepo. Surfaces GitHub's message on failure (e.g., branch
// protection, missing ref) so the UI can show the actual reason. "Reference
// does not exist" (422) is treated as success-equivalent — the end state we
// wanted is reached. Caller learns this via alreadyGone.
export async function deleteRemoteBranch(
    owner: string,
    repo: string,
    branch: string,
    token: string,
): Promise<{ ok: true; alreadyGone?: boolean } | { ok: false; error: string }> {
    requireParam(owner, 'owner is required');
    requireParam(repo, 'repo is required');
    requireParam(branch, 'branch is required');
    requireParam(token, 'GitHub token is required');

    const octokit = new Octokit({ auth: token });
    try {
        await octokit.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
        return { ok: true };
    } catch (e) {
        const err = e as { status?: number; message?: string };
        if (err.status === 422 && (err.message ?? '').toLowerCase().includes('reference does not exist')) {
            return { ok: true, alreadyGone: true };
        }
        return { ok: false, error: err.message ?? `Delete failed (status ${err.status ?? '?'})` };
    }
}
