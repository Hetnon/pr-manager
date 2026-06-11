import { useContext, useState } from 'react';
import type { LocalBranch, LocalRepoSnapshot } from '../../readLocalRepo.js';
import { RepoContext } from '../../../../repo/RepoContext.js';
import { pushBranchToOrigin } from '../../pushBranchToOrigin.js';
import { createPr } from '../../../../api/prs.js';
import type { PrOutcome } from '../../types.js';

// Owns the "push branch and open its PR" action. Lives with BranchList. Pushes
// the branch to origin first (GitHub requires the head branch to exist on the
// remote before a PR can reference it), then opens the PR from the pushed/folded
// name against the default branch.
export function useOpenPr(
    snapshot: LocalRepoSnapshot | null,
    refresh: (currentRepoFolderHandle: FileSystemDirectoryHandle) => Promise<void>,
    onOpened?: () => void,
) {
    const { currentRepoFolderHandle, currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const [openingPr, setOpeningPr] = useState<string | null>(null);
    const [lastPr, setLastPr] = useState<PrOutcome | null>(null);

    async function openPr(branch: LocalBranch) {
        if (!currentRepoFolderHandle || !owner || !repo || !snapshot?.defaultBranch) return;
        const pushName = branch.name;
        const defaultTitle = branch.head?.message ?? pushName;
        const title = globalThis.prompt(`PR title for ${pushName} → ${snapshot.defaultBranch}?`, defaultTitle);
        if (title === null) return; // cancelled

        setOpeningPr(branch.name);
        setLastPr(null);
        try {
            const result = await pushBranchToOrigin(currentRepoFolderHandle, branch, owner, repo);
            if (!result.ok) {
                setLastPr({ ok: false, branch: result.pushName, message: result.message });
                return;
            }
            try {
                const createdPr = await createPr({
                    owner, repo,
                    head: result.pushName,
                    base: snapshot.defaultBranch,
                    title,
                });
                setLastPr({ ok: true, branch: result.pushName, prNumber: createdPr.number, prUrl: createdPr.url });
                onOpened?.();
            } catch (error) {
                // Push succeeded but PR creation failed — surface both facts.
                const message = error instanceof Error ? error.message : String(error);
                setLastPr({ ok: false, branch: result.pushName, message: `Push OK, but PR create failed: ${message}` });
            }
        } finally {
            setOpeningPr(null);
        }
    }

    return { openingPr, lastPr, openPr };
}
