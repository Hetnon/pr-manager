import { useMemo } from 'react';
import type { PR } from '@shared/pr.js';
import { buildSharedFileMatrix } from './sharedFiles.js';
import { usePromotedPrs } from './MasterCheck/hooks/usePromotedPrs.js';
import { useMasterConflicts } from './MasterCheck/hooks/useMasterConflicts.js';
import { useLocalPairwise } from './MasterCheck/hooks/useLocalPairwise.js';

// The view-independent PR analysis: the shared-file matrix, the green/non-green
// split, the promotion state + candidate set, and the two async conflict checks
// (server-side vs master + browser-side pairwise). Mirrors useBranchAnalysis on
// the PR side so it can run at the app level regardless of the active view.
export function usePrAnalysis(prs: PR[], owner: string, repo: string, folderHandle: FileSystemDirectoryHandle | null) {
    const matrix = useMemo(() => buildSharedFileMatrix(prs), [prs]);
    const { sortedPrs, prSafe } = matrix;
    const greens = useMemo(() => sortedPrs.filter((pr) => prSafe.get(pr.number)), [sortedPrs, prSafe]);
    const nonGreens = useMemo(() => sortedPrs.filter((pr) => !prSafe.get(pr.number)), [sortedPrs, prSafe]);

    // Per-PR map of "files this PR shares with other PRs" — drives the
    // "Conflicting PRs" panel so a tech lead can see what they're choosing about.
    const conflictsByPr = useMemo(() => {
        const fileToAllPrs = new Map<string, number[]>();
        for (const pr of prs) {
            for (const file of pr.files) {
                if (!fileToAllPrs.has(file.path)) fileToAllPrs.set(file.path, []);
                fileToAllPrs.get(file.path)!.push(pr.number);
            }
        }
        const conflictsByPr = new Map<number, Array<{ file: string; others: number[] }>>();
        for (const pr of prs) {
            const entries: Array<{ file: string; others: number[] }> = [];
            for (const file of pr.files) {
                const others = (fileToAllPrs.get(file.path) ?? []).filter((otherPrNumber) => otherPrNumber !== pr.number);
                if (others.length > 0) entries.push({ file: file.path, others });
            }
            conflictsByPr.set(pr.number, entries);
        }
        return conflictsByPr;
    }, [prs]);

    const { promoted, togglePromoted } = usePromotedPrs(sortedPrs);

    const readyToCheck = useMemo(
        () => [...greens, ...nonGreens.filter((pr) => promoted.has(pr.number))],
        [greens, nonGreens, promoted],
    );
    // The matrix for the ready-to-check subset is a different one than the full
    // matrix above — built here so PrMatrix stays purely presentational.
    const readyMatrix = useMemo(() => buildSharedFileMatrix(readyToCheck), [readyToCheck]);

    const masterConflicts = useMasterConflicts(owner, repo, prs, readyToCheck, promoted);
    const { localPairwise, pairwise } = useLocalPairwise(owner, repo, prs, readyToCheck, promoted, folderHandle);

    return {
        matrix, greens, nonGreens, conflictsByPr,
        promoted, togglePromoted, readyToCheck, readyMatrix,
        ...masterConflicts,   // results, loading, error, lookups, masterTouchByFile
        localPairwise, pairwise,
    };
}
