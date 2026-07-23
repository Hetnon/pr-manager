import { useContext, useState } from 'react';
import { RepoContext } from '../../../../repo/RepoContext.js';
import { checkoutLocalBranch, detachHeadAndDeleteBranch } from '../../../../api/git.js';
import { deleteBranchEverywhere } from '../BranchConflictReport/DuplicatesBanner/useDeleteBranch/branchDeletion.js';

// Row-level branch admin: delete a local branch, or switch away from the current
// one (a prerequisite to deleting it — you can't delete the checked-out branch
// without breaking HEAD). Delete is local-only here: this is about clearing local
// clutter, not touching origin. Both re-read the repo on success via `refresh`.
export function useBranchLifecycle(
    refresh: (currentRepoFolderHandle: FileSystemDirectoryHandle) => Promise<void>,
) {
    const { currentRepoFolderHandle, currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const [busyBranch, setBusyBranch] = useState<string | null>(null);
    const [progress, setProgress] = useState<string | null>(null);
    const [errorByBranch, setErrorByBranch] = useState<Map<string, string>>(new Map());

    const recordError = (name: string, message: string | null) =>
        setErrorByBranch((current) => {
            const next = new Map(current);
            if (message) next.set(name, message); else next.delete(name);
            return next;
        });

    async function deleteBranch(name: string) {
        if (!currentRepoFolderHandle) return;
        if (!globalThis.confirm(`Delete local branch ${name}? This removes it from your machine only (origin is not touched). This is destructive.`)) return;
        setBusyBranch(name);
        recordError(name, null);
        try {
            const result = await deleteBranchEverywhere(currentRepoFolderHandle, owner, repo, name, 'local');
            if (result.local.ok) {
                await refresh(currentRepoFolderHandle);
            } else {
                recordError(name, result.local.error ?? 'Delete failed');
            }
        } finally {
            setBusyBranch(null);
        }
    }

    // Delete the current branch the fast way: detach HEAD at its own commit (no
    // working-tree rewrite), then drop the ref. Leaves a detached HEAD.
    async function deleteCurrentBranch(name: string, sha: string) {
        if (!currentRepoFolderHandle) return;
        if (!globalThis.confirm(
            `Delete ${name} (the current branch)? HEAD detaches onto the same commit (${sha.slice(0, 8)}) — no files change and nothing is rewritten. You'll be on no branch (detached HEAD) until you check one out. This is destructive.`
        )) return;
        setBusyBranch(name);
        recordError(name, null);
        try {
            const result = await detachHeadAndDeleteBranch(currentRepoFolderHandle, name, sha);
            if (result.ok) {
                await refresh(currentRepoFolderHandle);
            } else {
                recordError(name, result.error);
            }
        } finally {
            setBusyBranch(null);
        }
    }

    async function switchBranch(from: string, to: string) {
        if (!currentRepoFolderHandle) return;
        if (!globalThis.confirm(`Switch from ${from} to ${to}? This checks out ${to} into your working tree.`)) return;
        setBusyBranch(from);
        setProgress(null);
        recordError(from, null);
        try {
            const result = await checkoutLocalBranch(currentRepoFolderHandle, to, (p) => {
                setProgress(p.total ? `${p.phase} ${Math.round((p.loaded / p.total) * 100)}%` : p.phase);
            });
            if (result.ok) {
                await refresh(currentRepoFolderHandle);
            } else {
                recordError(from, result.error);
            }
        } finally {
            setBusyBranch(null);
            setProgress(null);
        }
    }

    return { busyBranch, progress, errorByBranch, deleteBranch, deleteCurrentBranch, switchBranch };
}
