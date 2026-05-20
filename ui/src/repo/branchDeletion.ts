import * as git from 'isomorphic-git';
import type { BranchTarget, DeleteBranchResult } from '@shared/branches.js';
import { deleteRemoteBranch } from '../api/branches.js';
import { makeFsApiFs } from './fsApiAdapter.js';

// Reusable branch-deletion orchestrator. Targets local, origin, or both.
// Returns per-side outcomes so the caller can render granular feedback ("local
// gone but origin protected" etc.). Doesn't throw — surfaces errors in the
// result.
//
// Local-side requires readwrite folder permission and uses isomorphic-git's
// deleteBranch. Origin-side hits POST /api/delete-branch which calls Octokit's
// git.deleteRef with the user's OAuth token server-side.
export async function deleteBranchEverywhere(
    handle: FileSystemDirectoryHandle | null,
    owner: string | null,
    repo: string | null,
    branch: string,
    targets: BranchTarget,
): Promise<DeleteBranchResult> {
    const wantLocal = targets === 'local' || targets === 'both';
    const wantOrigin = targets === 'origin' || targets === 'both';
    const result: DeleteBranchResult = {
        branch,
        local: { attempted: false, ok: false },
        origin: { attempted: false, ok: false },
    };

    if (wantLocal) {
        result.local.attempted = true;
        if (!handle) {
            result.local.error = 'No folder handle';
        } else {
            try {
                const fs = makeFsApiFs(handle);
                await git.deleteBranch({ fs, dir: '/', ref: branch });
                result.local.ok = true;
            } catch (e) {
                result.local.error = (e as Error).message;
            }
        }
    }

    if (wantOrigin) {
        result.origin.attempted = true;
        if (!owner || !repo) {
            result.origin.error = 'No owner/repo';
        } else {
            try {
                const resp = await deleteRemoteBranch(owner, repo, branch);
                result.origin.ok = resp.ok;
                if (resp.ok) result.origin.alreadyGone = resp.alreadyGone;
                else result.origin.error = resp.error;
            } catch (e) {
                result.origin.error = (e as Error).message;
            }
        }
        // Whether the API call deleted the ref or reported it already-gone,
        // the local remote-tracking ref refs/remotes/origin/<branch> is
        // stale. Drop it here so we don't wait for the next fetch --prune.
        // Best-effort: silent if the ref doesn't exist or the call fails.
        if (handle) {
            try {
                const fs = makeFsApiFs(handle);
                await git.deleteRef({ fs, dir: '/', ref: `refs/remotes/origin/${branch}` });
                result.remoteTrackingCleaned = true;
            } catch {
                result.remoteTrackingCleaned = false;
            }
        }
    }

    return result;
}
