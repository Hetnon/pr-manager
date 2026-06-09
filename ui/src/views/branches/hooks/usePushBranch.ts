import { useState } from 'react';
import type { PR } from '@shared/pr.js';
import type { LocalBranch, LocalRepoSnapshot } from '../readLocalRepo.js';
import { pushBranchToOrigin } from '../pushBranchToOrigin.js';
import type { PushOutcome } from '../types.js';

// Owns the "push branch to origin" backup action — get a branch's committed work
// onto the remote without opening a PR (for solo work, or saving in-progress work
// off your laptop). Lives with BranchList. Pushing a branch that already has an
// open PR updates that PR — a PR is a live view of its head branch, with no
// per-push opt-out — so we confirm first.
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

    async function pushBranch(branch: LocalBranch, existingPr?: PR | null) {
        if (!folderHandle || !owner || !repo || !snapshot) return;
        if (existingPr && !globalThis.confirm(
            `Push new commits to ${branch.name}? This updates open PR #${existingPr.number} — the PR always reflects this branch's latest pushed commits.`
        )) return;
        setPushingBranch(branch.name);
        setLastPush(null);
        try {
            const localNames = new Set(snapshot.branches.map((localBranch) => localBranch.name));
            const result = await pushBranchToOrigin(folderHandle, branch, localNames, owner, repo);
            if (!result.ok) {
                setLastPush({ ok: false, branch: result.pushName, message: result.message });
                return;
            }
            setLastPush(existingPr
                ? { ok: true, branch: result.pushName, updatedPr: { number: existingPr.number, url: existingPr.url } }
                : { ok: true, branch: result.pushName });
            if (result.folded) await refresh(folderHandle); // reflect the fold (X-dedup gone, X moved)
            onPushed?.();
        } finally {
            setPushingBranch(null);
        }
    }

    return { pushingBranch, lastPush, pushBranch };
}
