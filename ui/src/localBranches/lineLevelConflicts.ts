import * as git from 'isomorphic-git';
import { structuredPatch } from 'diff';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';
import type { BranchChanges, ConflictProgressCallback } from './checkLocalConflicts.js';
import type { ConflictCache, PairVerdict } from './conflictCache.js';

type Fs = ReturnType<typeof makeFsApiFs>;

export type FileSeverity = 'safe' | 'warning' | 'conflict';

interface BaseHunk { baseStart: number; baseLines: number; }

interface BranchFileDiff {
    baseMissing: boolean;
    headMissing: boolean;
    binary: boolean;
    hunks: BaseHunk[];
}

// For every file touched by 2+ branches, computes line-level severity. Each
// (branch-pair, file) verdict is cached in the persistent ConflictCache —
// keyed only by the SHAs involved, so any unchanged pair is hit on subsequent
// runs even after other branches change or get deleted.
export async function computeFileSeverity(
    handle: FileSystemDirectoryHandle,
    branchChanges: BranchChanges[],
    cache: ConflictCache,
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

    // Per-run scratch caches (don't get persisted — base blobs are big).
    const baseBlobCache = new Map<string, Uint8Array | null>();
    const branchDiffCache = new Map<string, BranchFileDiff>();  // key: branchSha|baseSha|file

    for (let i = 0; i < multiTouchFiles.length; i++) {
        const f = multiTouchFiles[i];
        onProgress?.({ phase: 'line-level', current: i + 1, total: multiTouchFiles.length, file: f });

        if (i % 25 === 0 && i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const branchesTouching = fileToBranches.get(f)!;
        let result: FileSeverity = 'warning';

        outer: for (let a = 0; a < branchesTouching.length; a++) {
            const bcA = bcByName.get(branchesTouching[a]);
            if (!bcA || bcA.error || !bcA.base) continue;
            for (let b = a + 1; b < branchesTouching.length; b++) {
                const bcB = bcByName.get(branchesTouching[b]);
                if (!bcB || bcB.error || !bcB.base) continue;

                // Pair cache lookup — pure function of the two SHAs and the file path.
                const cacheKey = cache.pairResultKey(bcA.sha, bcB.sha, f);
                let verdict: PairVerdict | undefined = cache.pairResults.get(cacheKey);
                if (verdict !== undefined) {
                    cache.hits++;
                } else {
                    cache.misses++;
                    const diffA = await getOrComputeBranchDiff(fs, dir, bcA.sha, bcA.base, f, baseBlobCache, branchDiffCache);
                    const diffB = await getOrComputeBranchDiff(fs, dir, bcB.sha, bcB.base, f, baseBlobCache, branchDiffCache);
                    verdict = pairVerdict(diffA, diffB);
                    cache.pairResults.set(cacheKey, verdict);
                }
                if (verdict === 'conflict') { result = 'conflict'; break outer; }
            }
        }

        severity.set(f, result);
    }
    return severity;
}

function pairVerdict(a: BranchFileDiff, b: BranchFileDiff): PairVerdict {
    if (a.headMissing && !b.headMissing && b.hunks.length > 0) return 'conflict';
    if (b.headMissing && !a.headMissing && a.hunks.length > 0) return 'conflict';
    if (a.headMissing && b.headMissing) return 'clean';
    if (a.binary || b.binary) return 'unknown';
    return hunksOverlap(a.hunks, b.hunks) ? 'conflict' : 'clean';
}

function hunksOverlap(a: BaseHunk[], b: BaseHunk[]): boolean {
    for (const ai of a) {
        const aEnd = ai.baseStart + ai.baseLines;
        for (const bi of b) {
            const bEnd = bi.baseStart + bi.baseLines;
            if (ai.baseStart < bEnd && bi.baseStart < aEnd) return true;
        }
    }
    return false;
}

async function getOrComputeBranchDiff(
    fs: Fs, dir: string,
    branchSha: string, baseSha: string,
    filepath: string,
    baseBlobCache: Map<string, Uint8Array | null>,
    branchDiffCache: Map<string, BranchFileDiff>,
): Promise<BranchFileDiff> {
    const key = `${branchSha}|${baseSha}|${filepath}`;
    const cached = branchDiffCache.get(key);
    if (cached) return cached;
    const computed = await diffOneFile(fs, dir, baseSha, branchSha, filepath, baseBlobCache);
    branchDiffCache.set(key, computed);
    return computed;
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
    const limit = Math.min(bytes.length, 8192);
    for (let i = 0; i < limit; i++) {
        if (bytes[i] === 0) return true;
    }
    return false;
}
