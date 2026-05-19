import * as git from 'isomorphic-git';
import { structuredPatch } from 'diff';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';
import type { BranchChanges } from './checkLocalConflicts.js';

type Fs = ReturnType<typeof makeFsApiFs>;

export type FileSeverity = 'safe' | 'warning' | 'conflict';

// A hunk's coordinates in the BASE (merge-base) file. baseLines === 0 means a
// pure addition with no base lines touched.
interface BaseHunk { baseStart: number; baseLines: number; }

// Per-(branch, file) record. blob === null means the file doesn't exist at
// that side — pure add when missing on base, deletion when missing on head.
interface BranchFileDiff {
    baseMissing: boolean;
    headMissing: boolean;
    binary: boolean;
    hunks: BaseHunk[];
}

// For every file touched by 2+ branches, computes line-level severity:
//   - safe: only one branch touched the file
//   - conflict: at least one pair of branches has overlapping base hunks, OR
//     one branch deleted the file while another modified it
//   - warning: multi-branch but no overlap (or undecidable due to binary/error)
//
// Files touched by exactly one branch are marked safe without any blob reads.
// Known v1 limitation: pure additions (baseLines === 0) never "overlap" in our
// model, so two branches that both add the same file at line 1 are marked
// warning even though real git would conflict.
export async function computeFileSeverity(
    handle: FileSystemDirectoryHandle,
    branchChanges: BranchChanges[],
): Promise<Map<string, FileSeverity>> {
    const fs = makeFsApiFs(handle);
    const dir = '/';

    const fileToBranches = new Map<string, string[]>();
    for (const bc of branchChanges) {
        if (bc.error) continue;
        for (const f of bc.files) {
            if (!fileToBranches.has(f)) fileToBranches.set(f, []);
            fileToBranches.get(f)!.push(bc.branch);
        }
    }

    const severity = new Map<string, FileSeverity>();
    const multiTouchFiles: string[] = [];
    for (const [f, brs] of fileToBranches) {
        if (brs.length === 1) {
            severity.set(f, 'safe');
        } else {
            multiTouchFiles.push(f);
        }
    }

    if (multiTouchFiles.length === 0) return severity;

    // Compute diffs only for branches that touch a multi-touch file, and only
    // for those specific files. Caches per (branch.base, branch.sha, file).
    const diffByBranchFile = new Map<string, Map<string, BranchFileDiff>>();
    for (const bc of branchChanges) {
        if (bc.error || !bc.base) continue;
        const relevant = bc.files.filter((f) => fileToBranches.get(f)!.length > 1);
        if (relevant.length === 0) continue;
        const m = new Map<string, BranchFileDiff>();
        for (const f of relevant) {
            m.set(f, await diffOneFile(fs, dir, bc.base, bc.sha, f));
        }
        diffByBranchFile.set(bc.branch, m);
    }

    for (const f of multiTouchFiles) {
        const brs = fileToBranches.get(f)!;
        let result: FileSeverity = 'warning';
        outer: for (let i = 0; i < brs.length; i++) {
            const di = diffByBranchFile.get(brs[i])?.get(f);
            for (let j = i + 1; j < brs.length; j++) {
                const dj = diffByBranchFile.get(brs[j])?.get(f);
                if (!di || !dj) continue;
                if (pairConflicts(di, dj)) { result = 'conflict'; break outer; }
            }
        }
        severity.set(f, result);
    }
    return severity;
}

function pairConflicts(a: BranchFileDiff, b: BranchFileDiff): boolean {
    // Delete-vs-modify is a real conflict — one side has no head blob, the
    // other has changes.
    if (a.headMissing && !b.headMissing && b.hunks.length > 0) return true;
    if (b.headMissing && !a.headMissing && a.hunks.length > 0) return true;
    // Both deleted: trivially mergeable (same outcome) — not a conflict.
    if (a.headMissing && b.headMissing) return false;
    // If either side is binary we can't reason about lines — conservative: not
    // a conflict (caller leaves the file at 'warning').
    if (a.binary || b.binary) return false;
    return hunksOverlap(a.hunks, b.hunks);
}

function hunksOverlap(a: BaseHunk[], b: BaseHunk[]): boolean {
    for (const ai of a) {
        const aEnd = ai.baseStart + ai.baseLines;
        for (const bi of b) {
            const bEnd = bi.baseStart + bi.baseLines;
            // Half-open interval overlap test. Both being zero-length adds at
            // the same point intentionally doesn't count — see header comment.
            if (ai.baseStart < bEnd && bi.baseStart < aEnd) return true;
        }
    }
    return false;
}

async function diffOneFile(
    fs: Fs, dir: string,
    baseOid: string, headOid: string,
    filepath: string,
): Promise<BranchFileDiff> {
    const baseBlob = await tryReadBlob(fs, dir, baseOid, filepath);
    const headBlob = await tryReadBlob(fs, dir, headOid, filepath);
    const baseMissing = baseBlob === null;
    const headMissing = headBlob === null;
    if (baseMissing && headMissing) {
        return { baseMissing, headMissing, binary: false, hunks: [] };
    }
    const baseBytes = baseBlob ?? new Uint8Array();
    const headBytes = headBlob ?? new Uint8Array();
    if (looksBinary(baseBytes) || looksBinary(headBytes)) {
        return { baseMissing, headMissing, binary: true, hunks: [] };
    }
    const baseText = new TextDecoder('utf-8', { fatal: false }).decode(baseBytes);
    const headText = new TextDecoder('utf-8', { fatal: false }).decode(headBytes);
    const patch = structuredPatch(filepath, filepath, baseText, headText, '', '', { context: 0 });
    const hunks: BaseHunk[] = patch.hunks.map((h) => ({
        baseStart: h.oldStart,
        baseLines: h.oldLines,
    }));
    return { baseMissing, headMissing, binary: false, hunks };
}

async function tryReadBlob(fs: Fs, dir: string, commitOid: string, filepath: string): Promise<Uint8Array | null> {
    try {
        const result = await git.readBlob({ fs, dir, oid: commitOid, filepath });
        return result.blob;
    } catch {
        return null;
    }
}

function looksBinary(bytes: Uint8Array): boolean {
    // Common heuristic: a NUL byte in the first 8KB means binary.
    const limit = Math.min(bytes.length, 8192);
    for (let i = 0; i < limit; i++) {
        if (bytes[i] === 0) return true;
    }
    return false;
}
