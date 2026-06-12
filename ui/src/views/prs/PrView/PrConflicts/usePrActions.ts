import { useCallback, useContext, useState } from 'react';
import type { MergePrResult } from '@shared/merge.js';
import { RepoContext } from '../../../../repo/RepoContext.js';
import * as prApi from '../../../../api/prs.js';
import type { LastMerge } from '../../types.js';

// Squash-merge action for a PR, plus its in-flight / last-result state and the
// per-PR "skip branch delete" opt-out. `onMerged` fires after a successful merge
// so the caller can refresh the PR list. (Closing a PR lives in the shared
// useClosePr hook.)
export function usePrActions(onMerged?: () => void) {
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const [merging, setMerging] = useState<number | null>(null);
    const [lastMerge, setLastMerge] = useState<LastMerge>(null);
    // Per-PR "skip branch delete" set. Default is delete; users opt out per PR.
    const [skipBranchDelete, setSkipBranchDelete] = useState<Set<number>>(new Set());

    const toggleSkipBranchDelete = useCallback((prNumber: number, skip: boolean) => {
        setSkipBranchDelete((current) => {
            const next = new Set(current);
            if (skip) next.add(prNumber); else next.delete(prNumber);
            return next;
        });
    }, []);

    const handleMerge = useCallback(async (prNumber: number) => {
        if (!owner || !repo) return;
        const deleteBranch = !skipBranchDelete.has(prNumber);
        const confirmMsg = `Squash-merge PR #${prNumber} on ${owner}/${repo}${deleteBranch ? ' (and delete the branch)' : ''}?`;
        if (!window.confirm(confirmMsg)) return;
        setMerging(prNumber);
        setLastMerge(null);
        try {
            const mergeResult: MergePrResult = await prApi.mergePr(owner, repo, prNumber, 'squash', deleteBranch);
            if (!mergeResult.ok) {
                if ('preflight' in mergeResult) {
                    setLastMerge({
                        ok: false,
                        prNumber,
                        message: mergeResult.preflight === 'wrong-branch'
                            ? `Server reports it's not on the default branch (${mergeResult.defaultBranch}).`
                            : `Working tree on ${mergeResult.defaultBranch} is dirty.`,
                    });
                    return;
                }
                setLastMerge({ ok: false, prNumber, message: mergeResult.error });
                return;
            }
            setLastMerge({ ok: true, prNumber, steps: mergeResult.steps, branchDeleteError: mergeResult.branchDeleteError });
            onMerged?.();
        } catch (error) {
            setLastMerge({ ok: false, prNumber, message: (error as Error).message });
        } finally {
            setMerging(null);
        }
    }, [owner, repo, skipBranchDelete, onMerged]);

    return {
        merging, lastMerge,
        skipBranchDelete, toggleSkipBranchDelete,
        handleMerge,
    };
}
