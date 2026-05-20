import * as git from 'isomorphic-git';
import { structuredPatch } from 'diff';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';
import type { BranchChanges, ConflictProgressCallback } from './checkLocalConflicts.js';

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
// Processed strictly per-file so the progress callback can report each one
// as it's worked on. Base blobs are cached across branches that share the
// same merge-base — meaningful saving when several branches forked from the
// same upstream commit (the common case).
//
// Files touched by exactly one branch are marked safe without any blob reads.
// Known v1 limitation: pure additions (baseLines === 0) never "overlap" in our
// model, so two branches that both add the same file at line 1 are marked
// warning even though real git would conflict.
export async function computeFileSeverity(
    handle: FileSystemDirectoryHandle,
    branchChanges: BranchChanges[],
    onProgress?: ConflictProgressCallback,
): Promise<Map<string, FileSeverity>> {
    const fs = makeFsApiFs(handle);
    const dir = '/';

    const bcByName = new Map<string, BranchChanges>();
    for (const bc of branchChanges) bcByName.set(bc.branch, bc);

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

    onProgress?.({ phase: 'pairwise', multiTouchFiles: multiTouchFiles.length });
    if (multiTouchFiles.length === 0) return severity;

    // Shared base-blob cache, keyed by (baseOid, filepath). Reused across
    // every branch that shares the same merge-base — for newly-forked work
    // (the common case) every branch hits the same base, so this cuts the
    // total blob reads by ~ (branchCount - 1) / branchCount.
    const baseBlobCache = new Map<string, Uint8Array | null>();

    for (let i = 0; i < multiTouchFiles.length; i++) {
        const f = multiTouchFiles[i];
        onProgress?.({ phase: 'line-level', current: i + 1, total: multiTouchFiles.length, file: f });

        // Yield to the React render loop every so often so the progress modal
        // actually paints. Awaits in the diff loop are microtasks which don't
        // unblock rendering; setTimeout(0) is a macrotask which does.
        if (i % 25 === 0 && i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const branchesTouching = fileToBranches.get(f)!;

        // Compute one diff per branch that touches this file. Stop early if a
        // confirmed conflict is found (any subsequent pair would just confirm).
        const diffs = new Map<string, BranchFileDiff>();
        let result: FileSeverity = 'warning';

        for (const branchName of branchesTouching) {
            const bc = bcByName.get(branchName);
            if (!bc || bc.error || !bc.base) continue;
            const diff = await diffOneFile(fs, dir, bc.base, bc.sha, f, baseBlobCache);
            diffs.set(branchName, diff);

            // Pairwise check against branches we've already diffed.
            for (const [otherName, otherDiff] of diffs) {
                if (otherName === branchName) continue;
                if (pairConflicts(diff, otherDiff)) {
                    result = 'conflict';
                    break;
                }
            }
            if (result === 'conflict') break;
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
    baseCache: Map<string, Uint8Array | null>,
): Promise<BranchFileDiff> {
    const baseBlob = await readBaseBlobCached(fs, dir, baseOid, filepath, baseCache);
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

async function readBaseBlobCached(
    fs: Fs, dir: string,
    baseOid: string, filepath: string,
    cache: Map<string, Uint8Array | null>,
): Promise<Uint8Array | null> {
    const key = `${baseOid}\0${filepath}`;
    if (cache.has(key)) return cache.get(key) ?? null;
    const blob = await tryReadBlob(fs, dir, baseOid, filepath);
    cache.set(key, blob);
    return blob;
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
