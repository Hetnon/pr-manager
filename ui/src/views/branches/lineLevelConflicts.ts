import * as git from 'isomorphic-git';
import { structuredPatch } from 'diff';
import { diff3Merge } from 'node-diff3';
import { makeFsApiFs } from '../../fsAdapterForUI/fsApiAdapter.js';
import type { BranchChanges, ConflictProgressCallback } from './checkLocalConflicts.js';
import type { ConflictCache, PairResult, BranchFileInfo, LineRange } from './conflictCache.js';

type Fs = ReturnType<typeof makeFsApiFs>;

export type FileSeverity = 'safe' | 'identical' | 'warning' | 'conflict';

// What one branch changed in a file, relative to its default merge-base.
export interface BranchEdit {
    branch: string;
    ranges: LineRange[];   // 1-based, inclusive base-file line spans
    headMissing: boolean;  // the branch deleted the file
    binary: boolean;
}

// A pair of branches that genuinely clash on this file, with the base-file
// line spans where the 3-way merge couldn't reconcile them.
export interface ConflictPair {
    branchA: string;
    branchB: string;
    regions: LineRange[];
}

// Everything the matrix needs to color a file and explain it on hover.
export interface FileConflictDetail {
    severity: FileSeverity;
    edits: BranchEdit[];
    conflicts: ConflictPair[];
    // Groups of branches (each >= 2) that share byte-identical content for this
    // file. When severity === 'identical' there's a single group containing every
    // touching branch; otherwise these flag redundant duplicates *within* a
    // warning/conflict file (so those cells can be tinted identical-blue while the
    // odd one out keeps the file's warning/conflict color).
    identicalGroups?: string[][];
}

const decoder = new TextDecoder('utf-8', { fatal: false });

// For every file touched by 2+ branches, computes a per-file conflict verdict
// via real 3-way merge (the same engine the PR matrix uses), plus the data the
// UI needs to explain it: which branches edit which line ranges, where genuine
// conflicts land, and whether any branches are byte-identical. Each
// (branch-pair, file) and (branch, file) result is cached by SHA, so unchanged
// inputs are hit on later runs even after other branches change or get deleted.
export async function computeFileConflicts(
    handle: FileSystemDirectoryHandle,
    branchChanges: BranchChanges[],
    cache: ConflictCache,
    onProgress?: ConflictProgressCallback,
    // Signals that a file produced new (uncached) results. Non-blocking: the
    // caller hands off to a background writer, so an interrupted run — including
    // a tab close or reload — keeps its progress without stalling computation.
    persist?: () => void,
): Promise<Map<string, FileConflictDetail>> {
    const fs = makeFsApiFs(handle);
    const dir = '/';

    const branchChangeByName = new Map<string, BranchChanges>();
    for (const branchChange of branchChanges) branchChangeByName.set(branchChange.branch, branchChange);

    const fileToBranches = new Map<string, string[]>();
    for (const branchChange of branchChanges) {
        if (branchChange.error) continue;
        for (const file of branchChange.files) {
            if (!fileToBranches.has(file)) fileToBranches.set(file, []);
            fileToBranches.get(file)!.push(branchChange.branch);
        }
    }

    const detail = new Map<string, FileConflictDetail>();
    const multiTouchFiles: string[] = [];
    for (const [file, branchesForFile] of fileToBranches) {
        if (branchesForFile.length === 1) {
            detail.set(file, { severity: 'safe', edits: [], conflicts: [] });
        } else {
            multiTouchFiles.push(file);
        }
    }

    onProgress?.({ phase: 'pairwise', multiTouchFiles: multiTouchFiles.length });
    if (multiTouchFiles.length === 0) return detail;

    // Per-run scratch caches (not persisted — blobs are big, merge-bases cheap).
    const blobCache = new Map<string, Uint8Array | null>();  // `${commitOid}\0${file}` → bytes
    const pairBaseCache = new Map<string, string>();         // sorted sha pair → merge-base oid

    // Tracks the cache's miss count at the last persist, so we only flush after
    // files that actually computed something new (cache-hit files are free).
    // Starts at -1 so the first file flushes whatever earlier phases produced.
    let lastFlushMisses = -1;

    for (let i = 0; i < multiTouchFiles.length; i++) {
        const file = multiTouchFiles[i];
        onProgress?.({ phase: 'line-level', current: i + 1, total: multiTouchFiles.length, file });

        if (i % 25 === 0 && i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const branches = fileToBranches.get(file)!.filter((branchName) => {
            const branchChange = branchChangeByName.get(branchName);
            return branchChange && !branchChange.error && branchChange.base;
        });

        // Per-branch facts (blob oid + changed line ranges), cached by SHA.
        const edits: BranchEdit[] = [];
        const infoByBranch = new Map<string, BranchFileInfo>();
        for (const branchName of branches) {
            const branchChange = branchChangeByName.get(branchName)!;
            const info = await getOrComputeBranchFileInfo(fs, dir, branchChange.sha, branchChange.base, file, cache, blobCache);
            infoByBranch.set(branchName, info);
            edits.push({ branch: branchName, ranges: info.ranges, headMissing: info.headMissing, binary: info.binary });
        }

        // Identical: every touching branch has the same (non-null) blob oid.
        const oids = branches.map((branchName) => infoByBranch.get(branchName)?.oid ?? null);
        const allPresentSame = oids.length >= 2 && oids.every((oid) => oid !== null && oid === oids[0]);
        if (allPresentSame) {
            detail.set(file, { severity: 'identical', edits, conflicts: [], identicalGroups: [[...branches]] });
        } else {
            // Otherwise, 3-way-merge every pair to find genuine conflicts.
            const conflicts: ConflictPair[] = [];
            for (let firstIndex = 0; firstIndex < branches.length; firstIndex++) {
                const branchChangeA = branchChangeByName.get(branches[firstIndex])!;
                for (let secondIndex = firstIndex + 1; secondIndex < branches.length; secondIndex++) {
                    const branchChangeB = branchChangeByName.get(branches[secondIndex])!;
                    const result = await getOrComputePairResult(fs, dir, branchChangeA.sha, branchChangeB.sha, file, cache, blobCache, pairBaseCache);
                    if (result.verdict === 'conflict') {
                        conflicts.push({ branchA: branches[firstIndex], branchB: branches[secondIndex], regions: result.regions ?? [] });
                    }
                }
            }
            const severity: FileSeverity = conflicts.length > 0 ? 'conflict' : 'warning';
            detail.set(file, { severity, edits, conflicts, identicalGroups: findIdenticalGroups(branches, infoByBranch) });
        }

        // Signal as soon as this file added new results, so a tab close / reload
        // mid-run doesn't discard everything computed so far. Non-blocking — the
        // background writer coalesces and serializes the actual disk writes.
        if (persist && cache.misses !== lastFlushMisses) {
            lastFlushMisses = cache.misses;
            persist();
        }
    }
    return detail;
}

// Every set (>= 2) of branches sharing one blob oid — surfaced even when the
// file isn't fully identical, so those cells can be tinted blue and the tooltip
// can say "B and C are identical".
function findIdenticalGroups(branches: string[], infoByBranch: Map<string, BranchFileInfo>): string[][] | undefined {
    const byOid = new Map<string, string[]>();
    for (const br of branches) {
        const oid = infoByBranch.get(br)?.oid;
        if (!oid) continue;
        if (!byOid.has(oid)) byOid.set(oid, []);
        byOid.get(oid)!.push(br);
    }
    const groups = [...byOid.values()].filter((group) => group.length >= 2);
    return groups.length > 0 ? groups : undefined;
}

async function getOrComputeBranchFileInfo(
    fs: Fs, dir: string,
    branchSha: string, baseSha: string, file: string,
    cache: ConflictCache,
    blobCache: Map<string, Uint8Array | null>,
): Promise<BranchFileInfo> {
    const key = cache.branchFileInfoKey(branchSha, baseSha, file);
    const cached = cache.branchFileInfo.get(key);
    if (cached) { cache.hits++; return cached; }
    cache.misses++;

    const head = await readBlobWithOid(fs, dir, branchSha, file);
    const headMissing = head === null;
    let binary = false;
    let ranges: LineRange[] = [];
    if (!headMissing) {
        const baseBytes = await readBlobCached(fs, dir, baseSha, file, blobCache);
        const headBytes = head.bytes;
        if (looksBinary(headBytes) || (baseBytes && looksBinary(baseBytes))) {
            binary = true;
        } else {
            const patch = structuredPatch(file, file, decoder.decode(baseBytes ?? new Uint8Array()), decoder.decode(headBytes), '', '', { context: 0 });
            ranges = patch.hunks.map((hunk): LineRange => [hunk.oldStart, hunk.oldStart + Math.max(hunk.oldLines, 1) - 1]);
        }
    }
    const info: BranchFileInfo = { oid: head?.oid ?? null, ranges, headMissing, binary };
    cache.branchFileInfo.set(key, info);
    return info;
}

async function getOrComputePairResult(
    fs: Fs, dir: string,
    shaA: string, shaB: string, file: string,
    cache: ConflictCache,
    blobCache: Map<string, Uint8Array | null>,
    pairBaseCache: Map<string, string>,
): Promise<PairResult> {
    const key = cache.pairResultKey(shaA, shaB, file);
    const cached = cache.pairResults.get(key);
    if (cached) { cache.hits++; return cached; }
    cache.misses++;

    const baseKey = shaA < shaB ? `${shaA}|${shaB}` : `${shaB}|${shaA}`;
    let baseOid = pairBaseCache.get(baseKey);
    if (baseOid === undefined) {
        const [base] = await git.findMergeBase({ fs, dir, oids: [shaA, shaB] });
        baseOid = typeof base === 'string' ? base : '';
        pairBaseCache.set(baseKey, baseOid);
    }

    let result: PairResult;
    if (!baseOid) {
        result = { verdict: 'unknown' };
    } else {
        const baseBytes = await readBlobCached(fs, dir, baseOid, file, blobCache);
        const blobA = await readBlobWithOid(fs, dir, shaA, file);
        const blobB = await readBlobWithOid(fs, dir, shaB, file);
        result = mergeVerdict(baseBytes, blobA?.bytes ?? null, blobB?.bytes ?? null);
    }
    cache.pairResults.set(key, result);
    return result;
}

// Real 3-way merge of one file. excludeFalseConflicts means identical edits on
// both sides are NOT a conflict (matches git). Delete-vs-modify is a conflict;
// delete-vs-delete is clean; binary/unreadable sides bail to 'unknown'.
function mergeVerdict(baseBytes: Uint8Array | null, aBytes: Uint8Array | null, bBytes: Uint8Array | null): PairResult {
    const aMissing = aBytes === null;
    const bMissing = bBytes === null;
    if (aMissing && bMissing) return { verdict: 'clean' };
    if (aMissing || bMissing) return { verdict: 'conflict', regions: [] };
    if (looksBinary(aBytes!) || looksBinary(bBytes!) || (baseBytes && looksBinary(baseBytes))) {
        return { verdict: 'unknown' };
    }

    const baseText = decoder.decode(baseBytes ?? new Uint8Array());
    const aText = decoder.decode(aBytes!);
    const bText = decoder.decode(bBytes!);

    const regions: LineRange[] = [];
    const chunks = diff3Merge(aText, baseText, bText, { excludeFalseConflicts: true, stringSeparator: /\r?\n/ });
    for (const chunk of chunks) {
        if (chunk.conflict) {
            const baseLineIndex = chunk.conflict.oIndex;        // 0-based base line index
            const baseLineCount = chunk.conflict.o.length;
            regions.push([baseLineIndex + 1, baseLineIndex + Math.max(baseLineCount, 1)]);
        }
    }
    return regions.length > 0 ? { verdict: 'conflict', regions } : { verdict: 'clean' };
}

async function readBlobCached(
    fs: Fs, dir: string, commitOid: string, file: string,
    cache: Map<string, Uint8Array | null>,
): Promise<Uint8Array | null> {
    const key = `${commitOid}\0${file}`;
    if (cache.has(key)) return cache.get(key) ?? null;
    const blob = await readBlobWithOid(fs, dir, commitOid, file);
    const bytes = blob?.bytes ?? null;
    cache.set(key, bytes);
    return bytes;
}

async function readBlobWithOid(fs: Fs, dir: string, commitOid: string, file: string): Promise<{ oid: string; bytes: Uint8Array } | null> {
    try {
        const { oid, blob } = await git.readBlob({ fs, dir, oid: commitOid, filepath: file });
        return { oid, bytes: blob };
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
