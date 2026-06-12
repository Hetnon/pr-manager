import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../../adapters/fsApiAdapter.js';
import { computeFileConflicts, type FileConflictDetail } from './lineLevelConflicts.js';
import type { ConflictCache } from './conflictCache.js';
import { pairwiseFileOverlap } from '../../lib/fileOverlap.js';

type Fs = ReturnType<typeof makeFsApiFs>;

export interface BranchChanges {
    branch: string;
    sha: string;
    base: string;
    files: string[];
    error: string | null;
}

export interface BranchVsDefault {
    branch: string;
    defaultChangedFiles: string[];
    intersection: string[];
    error: string | null;
}

export interface BranchPair {
    a: string;
    b: string;
    intersection: string[];
}

export interface BranchGroup {
    sha: string;
    branches: string[];  // sorted; every branch name pointing at this sha
    canonical: string;   // alphabetically-first member — represents the group in analysis
}

export interface LocalConflictReport {
    defaultBranch: string;
    defaultSha: string;
    // Branches grouped by HEAD sha. Duplicates collapse to one canonical for analysis.
    branchGroups: BranchGroup[];
    // Only contains canonicals (one per group). Duplicate branches share the
    // canonical's analysis verbatim — no need to recompute.
    branchChanges: BranchChanges[];
    branchVsDefault: BranchVsDefault[];
    pairs: BranchPair[];
    // Per-file conflict detail from the 3-way-merge pass: severity, which
    // branches edit which line ranges, where genuine conflicts land, and any
    // byte-identical groups. Multi-touch files carry full detail; single-branch
    // files are simply 'safe'.
    fileDetail: Record<string, FileConflictDetail>;
    elapsedMs: number;
    cacheHits: number;
    cacheMisses: number;
}

// Progress events emitted during conflict analysis. The UI uses these to drive
// the live progress modal so the user knows the long-running work is moving.
export type ConflictProgress =
    | { phase: 'init' }
    // Emitted by the working-tree scan (readWorkingTreeStatus), which runs as the
    // first phase of a refresh — shares this modal/progress stream.
    | { phase: 'worktree'; scanned: number; file: string }
    | { phase: 'resolving'; current: number; total: number; branch: string }
    | { phase: 'branch-changes'; current: number; total: number; branch: string }
    | { phase: 'default-diff'; current: number; total: number; base: string }
    | { phase: 'pairwise'; multiTouchFiles: number }
    | { phase: 'line-level'; current: number; total: number; file: string }
    | { phase: 'done'; elapsedMs: number };

export type ConflictProgressCallback = (event: ConflictProgress) => void;

export async function checkLocalConflicts(
    handle: FileSystemDirectoryHandle,
    defaultBranch: string,
    branchesToCheck: string[],
    cache: ConflictCache,
    onProgress?: ConflictProgressCallback,
    // Signals (non-blocking) that a file computed new results, so the caller can
    // persist progress in the background. See computeFileConflicts.
    persist?: () => void,
): Promise<LocalConflictReport> {
    const startTime = performance.now();
    const fs = makeFsApiFs(handle);
    const dir = '/';
    onProgress?.({ phase: 'init' });

    const defaultSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${defaultBranch}` });

    // Resolve every branch's HEAD up front so we can group by sha and skip
    // recomputing analysis for duplicates.
    const resolved: { name: string; sha: string; error: string | null }[] = [];
    const toResolve = branchesToCheck.filter((name) => name !== defaultBranch);
    for (let i = 0; i < toResolve.length; i++) {
        const name = toResolve[i];
        onProgress?.({ phase: 'resolving', current: i + 1, total: toResolve.length, branch: name });
        try {
            const sha = await git.resolveRef({ fs, dir, ref: `refs/heads/${name}` });
            resolved.push({ name, sha, error: null });
        } catch (error) {
            resolved.push({ name, sha: '', error: (error as Error).message });
        }
    }

    const groupsBySha = new Map<string, string[]>();
    for (const resolvedBranch of resolved) {
        if (resolvedBranch.error) continue;
        if (!groupsBySha.has(resolvedBranch.sha)) groupsBySha.set(resolvedBranch.sha, []);
        groupsBySha.get(resolvedBranch.sha)!.push(resolvedBranch.name);
    }
    const branchGroups: BranchGroup[] = [];
    for (const [sha, names] of groupsBySha) {
        const sorted = [...names].sort();
        branchGroups.push({ sha, branches: sorted, canonical: sorted[0] });
    }
    branchGroups.sort((groupA, groupB) => groupA.canonical.localeCompare(groupB.canonical));

    // Per-branch: merge-base + changed files. Both cached by SHA-pair keys —
    // valid as long as the involved SHAs are unchanged.
    const branchChanges: BranchChanges[] = [];
    for (let i = 0; i < branchGroups.length; i++) {
        const group = branchGroups[i];
        onProgress?.({ phase: 'branch-changes', current: i + 1, total: branchGroups.length, branch: group.canonical });
        const branchChange: BranchChanges = { branch: group.canonical, sha: group.sha, base: '', files: [], error: null };
        try {
            branchChange.base = await getOrComputeMergeBase(fs, dir, group.sha, defaultSha, cache);
            if (!branchChange.base) {
                branchChange.error = 'no merge base with default';
            } else {
                branchChange.files = await getOrComputeBranchFiles(fs, dir, group.sha, branchChange.base, cache);
            }
        } catch (error) {
            branchChange.error = (error as Error).message;
        }
        branchChanges.push(branchChange);
    }
    // Errored branches show up but don't participate in analysis.
    for (const resolvedBranch of resolved) {
        if (!resolvedBranch.error) continue;
        branchGroups.push({ sha: '', branches: [resolvedBranch.name], canonical: resolvedBranch.name });
        branchChanges.push({ branch: resolvedBranch.name, sha: '', base: '', files: [], error: resolvedBranch.error });
    }

    // Default-changed-since-base, cached per (defaultSha, baseSha).
    const branchVsDefault: BranchVsDefault[] = [];
    const uniqueBases = [...new Set(branchChanges.filter((branchChange) => !branchChange.error && branchChange.base).map((branchChange) => branchChange.base))];
    let baseProgressIndex = 0;
    const defaultChangedByBase = new Map<string, string[]>();
    for (const branchChange of branchChanges) {
        if (branchChange.error || !branchChange.base) {
            branchVsDefault.push({
                branch: branchChange.branch, defaultChangedFiles: [], intersection: [],
                error: branchChange.error ?? 'no base',
            });
            continue;
        }
        let defaultChanged = defaultChangedByBase.get(branchChange.base);
        if (!defaultChanged) {
            baseProgressIndex++;
            onProgress?.({ phase: 'default-diff', current: baseProgressIndex, total: uniqueBases.length, base: branchChange.base });
            try {
                defaultChanged = await getOrComputeDefaultSinceBase(fs, dir, defaultSha, branchChange.base, cache);
                defaultChangedByBase.set(branchChange.base, defaultChanged);
            } catch (error) {
                branchVsDefault.push({
                    branch: branchChange.branch, defaultChangedFiles: [], intersection: [],
                    error: `default-since-base: ${(error as Error).message}`,
                });
                continue;
            }
        }
        const defaultSet = new Set(defaultChanged);
        branchVsDefault.push({
            branch: branchChange.branch,
            defaultChangedFiles: defaultChanged,
            intersection: branchChange.files.filter((file) => defaultSet.has(file)),
            error: null,
        });
    }

    // Pairwise file overlap across branches — the same kernel the PR matrix uses.
    // Errored branches carry no files, so they naturally produce no pairs.
    const pairs: BranchPair[] = pairwiseFileOverlap(
        branchChanges.map((branchChange) => ({ id: branchChange.branch, files: branchChange.files })),
    );

    const detailMap = await computeFileConflicts(handle, branchChanges, cache, onProgress, persist);
    const fileDetail: Record<string, FileConflictDetail> = {};
    for (const [filePath, detail] of detailMap) fileDetail[filePath] = detail;

    const elapsedMs = Math.round(performance.now() - startTime);
    onProgress?.({ phase: 'done', elapsedMs });

    return {
        defaultBranch, defaultSha, branchGroups, branchChanges, branchVsDefault, pairs, fileDetail,
        elapsedMs,
        cacheHits: cache.hits,
        cacheMisses: cache.misses,
    };
}

async function getOrComputeMergeBase(
    fs: Fs, dir: string, branchSha: string, defaultSha: string, cache: ConflictCache,
): Promise<string> {
    const key = cache.mergeBaseKey(branchSha, defaultSha);
    const cached = cache.mergeBases.get(key);
    if (cached !== undefined) { cache.hits++; return cached; }
    cache.misses++;
    const [base] = await git.findMergeBase({ fs, dir, oids: [defaultSha, branchSha] });
    const value = base ?? '';
    cache.mergeBases.set(key, value);
    return value;
}

async function getOrComputeBranchFiles(
    fs: Fs, dir: string, branchSha: string, baseSha: string, cache: ConflictCache,
): Promise<string[]> {
    const key = cache.branchFilesKey(branchSha, baseSha);
    const cached = cache.branchFiles.get(key);
    if (cached !== undefined) { cache.hits++; return cached; }
    cache.misses++;
    const files = await changedFiles(fs, dir, baseSha, branchSha);
    cache.branchFiles.set(key, files);
    return files;
}

async function getOrComputeDefaultSinceBase(
    fs: Fs, dir: string, defaultSha: string, baseSha: string, cache: ConflictCache,
): Promise<string[]> {
    const key = cache.defaultSinceBaseKey(defaultSha, baseSha);
    const cached = cache.defaultSinceBase.get(key);
    if (cached !== undefined) { cache.hits++; return cached; }
    cache.misses++;
    const files = await changedFiles(fs, dir, baseSha, defaultSha);
    cache.defaultSinceBase.set(key, files);
    return files;
}

async function changedFiles(fs: Fs, dir: string, fromOid: string, toOid: string): Promise<string[]> {
    if (fromOid === toOid) return [];
    const changedPaths: string[] = [];
    await git.walk({
        fs, dir,
        trees: [git.TREE({ ref: fromOid }), git.TREE({ ref: toOid })],
        map: async (filepath: string, entries: (git.WalkerEntry | null)[]) => {
            if (filepath === '.') return;
            const [fromEntry, toEntry] = entries;
            if (!fromEntry && !toEntry) return;
            const fromType = fromEntry ? await fromEntry.type() : null;
            const toType = toEntry ? await toEntry.type() : null;
            if (fromType === 'tree' || toType === 'tree') return;
            const fromEntryOid = fromEntry ? await fromEntry.oid() : null;
            const toEntryOid = toEntry ? await toEntry.oid() : null;
            if (fromEntryOid === toEntryOid) return;
            changedPaths.push(filepath);
        },
    });
    return changedPaths;
}
