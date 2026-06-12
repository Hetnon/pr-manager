import type { LocalBranch } from './readLocalRepo.js';
import { gitPushBranch } from '../../api/git.js';

export type PushToOriginResult =
    | { ok: true; pushName: string }
    | { ok: false; pushName: string; message: string };

// Gets a branch's committed tip onto origin. The shared primitive behind both the
// backup-push and open-PR actions — neither opens a PR; that's the caller's job.
export async function pushBranchToOrigin(
    currentRepoFolderHandle: FileSystemDirectoryHandle,
    branch: LocalBranch,
    owner: string,
    repo: string,
): Promise<PushToOriginResult> {
    const pushResult = await gitPushBranch(currentRepoFolderHandle, branch.name, owner, repo);
    if (!pushResult.ok) return { ok: false, pushName: branch.name, message: `Push failed: ${pushResult.error}` };
    return { ok: true, pushName: branch.name };
}
