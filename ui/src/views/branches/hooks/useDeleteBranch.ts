import { useState } from 'react';
import { deleteBranchEverywhere } from '../../../repo/branchDeletion.js';
import type { DeleteBranchResult } from '@shared/branches.js';

// Owns the "delete duplicate branch (local + origin)" action and its state.
// Lives with DuplicatesBanner. Re-reads the repo on success via `refresh`.
export function useDeleteBranch(
    folderHandle: FileSystemDirectoryHandle | null,
    owner: string | null,
    repo: string | null,
    refresh: (folderHandle: FileSystemDirectoryHandle) => Promise<void>,
) {
    const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
    const [lastDelete, setLastDelete] = useState<DeleteBranchResult | null>(null);

    async function deleteBranch(branchName: string) {
        if (!folderHandle) return;
        if (!window.confirm(`Delete branch ${branchName} locally and on origin? This is destructive.`)) return;
        setDeletingBranch(branchName);
        setLastDelete(null);
        try {
            const result = await deleteBranchEverywhere(folderHandle, owner, repo, branchName, 'both');
            setLastDelete(result);
            if (result.local.ok || result.origin.ok) {
                await refresh(folderHandle);
            }
        } finally {
            setDeletingBranch(null);
        }
    }

    return { deletingBranch, lastDelete, deleteBranch };
}
