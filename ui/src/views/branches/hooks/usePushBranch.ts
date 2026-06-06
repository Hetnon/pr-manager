import { useState } from 'react';
import type { LocalBranch, LocalRepoSnapshot } from '../readLocalRepo.js';
import { pushBranch as gitPushBranch } from '../pushBranch.js';
import { createPr } from '../../../api/git.js';
import { foldDedupIntoOriginal, DEDUP_SUFFIX } from '../createDedupBranch.js';
import { ensureFolderWritePermission } from '../../../repo/folderPermission.js';
import { workingTreeBlockReason } from '../workingTreeStatus.js';
import type { PushOutcome } from '../types.js';

// Owns the "push branch and open PR" action and its state. Lives with BranchList.
// Folds a `‹branch›-dedup` back onto its original before pushing, refuses against
// a dirty working tree when folding, and fires `onPushed` so the PR list refetches.
export function usePushBranch(
    folderHandle: FileSystemDirectoryHandle | null,
    owner: string | null,
    repo: string | null,
    snapshot: LocalRepoSnapshot | null,
    refresh: (folderHandle: FileSystemDirectoryHandle) => Promise<void>,
    onPushed?: () => void,
) {
    const [pushingBranch, setPushingBranch] = useState<string | null>(null);
    const [lastPush, setLastPush] = useState<PushOutcome | null>(null);

    async function pushBranch(branch: LocalBranch) {
        if (!folderHandle || !owner || !repo || !snapshot?.defaultBranch) return;
        // If this is a dedup copy whose original still exists, fold it back onto
        // the original's name (fast-forward) so we push one real branch, not the
        // -dedup. The PR is opened from the original name.
        const localNames = new Set(snapshot.branches.map((localBranch) => localBranch.name));
        const foldOriginal = branch.name.endsWith(DEDUP_SUFFIX)
            ? branch.name.slice(0, -DEDUP_SUFFIX.length)
            : null;
        const willFold = foldOriginal !== null && localNames.has(foldOriginal);
        const pushName = willFold ? foldOriginal! : branch.name;

        // Folding moves the original branch's ref — refuse if the working tree
        // is dirty (a dirty current branch would desync from the moved ref).
        if (willFold) {
            const blockReason = await workingTreeBlockReason(folderHandle, `folding ${branch.name} into ${foldOriginal}`);
            if (blockReason) {
                setLastPush({ ok: false, branch: pushName, message: blockReason });
                return;
            }
        }

        const defaultTitle = branch.head?.message ?? pushName;
        const title = window.prompt(`PR title for ${pushName} → ${snapshot.defaultBranch}?`, defaultTitle);
        if (title === null) return; // cancelled
        setPushingBranch(branch.name);
        setLastPush(null);
        try {
            const hasWritePermission = await ensureFolderWritePermission(folderHandle);
            if (!hasWritePermission) {
                setLastPush({ ok: false, branch: pushName, message: 'Write permission denied — push needs to update local refs.' });
                return;
            }
            if (willFold) {
                try {
                    await foldDedupIntoOriginal(folderHandle, branch.name, foldOriginal!);
                } catch (error) {
                    setLastPush({ ok: false, branch: pushName, message: `Couldn't fold ${branch.name} into ${foldOriginal}: ${(error as Error).message}` });
                    return;
                }
            }
            const pushResult = await gitPushBranch(folderHandle, pushName, owner, repo);
            if (!pushResult.ok) {
                setLastPush({ ok: false, branch: pushName, message: `Push failed: ${pushResult.error}` });
                return;
            }
            try {
                const createdPr = await createPr({
                    owner, repo,
                    head: pushName,
                    base: snapshot.defaultBranch,
                    title,
                });
                setLastPush({ ok: true, branch: pushName, prNumber: createdPr.number, prUrl: createdPr.url });
                if (willFold) await refresh(folderHandle); // reflect the fold (X-dedup gone, X moved)
                onPushed?.();
            } catch (error) {
                // Push succeeded but PR creation failed — surface both facts.
                const message = error instanceof Error ? error.message : String(error);
                setLastPush({ ok: false, branch: branch.name, message: `Push OK, but PR create failed: ${message}` });
            }
        } finally {
            setPushingBranch(null);
        }
    }

    return { pushingBranch, lastPush, pushBranch };
}
