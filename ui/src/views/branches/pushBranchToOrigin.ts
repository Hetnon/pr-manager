import type { LocalBranch } from './readLocalRepo.js';
import { gitPushBranch } from './gitPushBranch.js';
import { foldDedupIntoOriginal, DEDUP_SUFFIX } from './hooks/createDedupBranch.js';
import { workingTreeBlockReason } from './workingTreeStatus.js';

export type FoldPlan =
    | { pushName: string; willFold: true; foldOriginal: string }
    | { pushName: string; willFold: false; foldOriginal: string | null };

// A `‹branch›-dedup` copy whose original still exists locally is folded back onto
// the original (fast-forward) so we push one real branch, not the -dedup. The PR,
// if any, opens from the original name.
export function resolveFold(branch: LocalBranch, localBranchNames: Set<string>): FoldPlan {
    const foldOriginal = branch.name.endsWith(DEDUP_SUFFIX)
        ? branch.name.slice(0, -DEDUP_SUFFIX.length)
        : null;
    if (foldOriginal !== null && localBranchNames.has(foldOriginal)) {
        return { pushName: foldOriginal, willFold: true, foldOriginal };
    }
    return { pushName: branch.name, willFold: false, foldOriginal };
}

export type PushToOriginResult =
    | { ok: true; pushName: string; folded: boolean }
    | { ok: false; pushName: string; folded: boolean; message: string };

// Gets a branch's committed tip onto origin: folds a dedup copy back first
// (refusing against a dirty working tree, which would desync the moved ref),
// ensures write permission, then pushes. The shared primitive behind both the
// backup-push and open-PR actions — neither opens a PR; that's the caller's job.
export async function pushBranchToOrigin(
    currentRepoFolderHandle: FileSystemDirectoryHandle,
    branch: LocalBranch,
    localBranchNames: Set<string>,
    owner: string,
    repo: string,
): Promise<PushToOriginResult> {
    const { pushName, willFold, foldOriginal } = resolveFold(branch, localBranchNames);

    // Folding moves the original branch's ref — refuse if the working tree is
    // dirty (a dirty current branch would desync from the moved ref).
    if (willFold) {
        const blockReason = await workingTreeBlockReason(currentRepoFolderHandle, `folding ${branch.name} into ${foldOriginal}`);
        if (blockReason) return { ok: false, pushName, folded: false, message: blockReason };
    }

    if (willFold) {
        try {
            await foldDedupIntoOriginal(currentRepoFolderHandle, branch.name, foldOriginal);
        } catch (error) {
            return { ok: false, pushName, folded: false, message: `Couldn't fold ${branch.name} into ${foldOriginal}: ${(error as Error).message}` };
        }
    }

    const pushResult = await gitPushBranch(currentRepoFolderHandle, pushName, owner, repo);
    if (!pushResult.ok) return { ok: false, pushName, folded: willFold, message: `Push failed: ${pushResult.error}` };
    return { ok: true, pushName, folded: willFold };
}
