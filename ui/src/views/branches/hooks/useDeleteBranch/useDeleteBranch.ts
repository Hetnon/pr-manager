import { useContext, useState } from 'react';
import { RepoContext } from '../../../../repo/RepoContext.js';
import { deleteBranchEverywhere } from './branchDeletion.js';
import type { DeleteBranchResult } from '@shared/branches.js';

// Owns the "delete duplicate branch (local + origin)" action and its state.
// Lives with DuplicatesBanner. Re-reads the repo on success via `refresh`.
export function useDeleteBranch(
    refresh: (currentRepoFolderHandle: FileSystemDirectoryHandle) => Promise<void>,
) {
    const { currentRepoFolderHandle, currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
    const [lastDelete, setLastDelete] = useState<DeleteBranchResult | null>(null);

    async function deleteBranch(branchName: string) {
        if (!currentRepoFolderHandle) return;
        if (!globalThis.confirm(`Delete branch ${branchName} locally and on origin? This is destructive.`)) return;
        setDeletingBranch(branchName);
        setLastDelete(null);
        try {
            const result = await deleteBranchEverywhere(currentRepoFolderHandle, owner, repo, branchName, 'both');
            setLastDelete(result);
            if (result.local.ok || result.origin.ok) {
                await refresh(currentRepoFolderHandle);
            }
        } finally {
            setDeletingBranch(null);
        }
    }

    return { deletingBranch, lastDelete, deleteBranch };
}
