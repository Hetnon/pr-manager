import type { PR } from '@shared/pr.js';

export interface Matrix {
    sortedPrs: PR[];
    files: Array<[string, number[]]>;
    prSafe: Map<number, boolean>;
    safeCount: number;
    hotFileCount: number;
}

export function buildMatrix(prs: PR[]): Matrix {
    const fileToPRs = new Map<string, number[]>();
    for (const pr of prs) {
        for (const f of pr.files) {
            if (!fileToPRs.has(f.path)) fileToPRs.set(f.path, []);
            fileToPRs.get(f.path)!.push(pr.number);
        }
    }

    const sortedPrs = [...prs].sort((a, b) => a.number - b.number);
    const files = [...fileToPRs.entries()].sort((a, b) => {
        if (b[1].length !== a[1].length) return b[1].length - a[1].length;
        return a[0].localeCompare(b[0]);
    });

    const prSafe = new Map<number, boolean>();
    for (const pr of sortedPrs) {
        const sharesAny = pr.files.some((f) => (fileToPRs.get(f.path)?.length ?? 0) > 1);
        prSafe.set(pr.number, !sharesAny);
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
