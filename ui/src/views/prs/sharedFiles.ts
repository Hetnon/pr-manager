import type { PR } from '@shared/pr.js';
import { mapFilesToChangeSets } from '../../lib/fileOverlap.js';

export interface SharedFileMatrix {
    sortedPrs: PR[];
    files: Array<[string, number[]]>;
    prSafe: Map<number, boolean>;
    safeCount: number;
    hotFileCount: number;
}

// Detects which files are shared across the open PRs — i.e. the conflict *risk*
// surface. It works only from the file lists GitHub already gave us (no content
// is inspected), so a "hot" file means "touched by multiple PRs", not a proven
// merge conflict. The deeper line-level check lives in the branches view.

export function buildSharedFileMatrix(prs: PR[]): SharedFileMatrix {
    // file path -> the PRs that touch it; a path with >1 PR is a shared/hot file.
    const fileToPRs = mapFilesToChangeSets(
        prs.map((pr) => ({ id: pr.number, files: pr.files.map((file) => file.path) })),
    );

    const sortedPrs = [...prs].sort((prA, prB) => prA.number - prB.number); // sort the PRs by their PR numbers
    // sort files by PR count (hottest first); ties broken alphabetically by path
    const files = [...fileToPRs.entries()].sort(([pathA, prsA], [pathB, prsB]) => {
        if (prsB.length !== prsA.length) return prsB.length - prsA.length;
        return pathA.localeCompare(pathB);
    });

    const prSafe = new Map<number, boolean>();
    for (const pr of sortedPrs) {
        const sharesAny = pr.files.some((file) => (fileToPRs.get(file.path)?.length ?? 0) > 1);
        prSafe.set(pr.number, !sharesAny); // a PR is safe when none of its files are shared with another PR
    }

    return {
        sortedPrs,
        files,
        prSafe,
        safeCount: [...prSafe.values()].filter(Boolean).length,
        hotFileCount: files.filter(([, filePrs]) => filePrs.length > 1).length,
    };
}

export type HeatClass = 'heat-1' | 'heat-conflict';
export function heatClass(count: number): HeatClass {
    return count === 1 ? 'heat-1' : 'heat-conflict';
}
