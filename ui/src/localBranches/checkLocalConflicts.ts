import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';
import { computeFileSeverity, type FileSeverity } from './lineLevelConflicts.js';
import type { ConflictCache } from './conflictCache.js';

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
    // Per-file severity from the line-level pass. Files only appear here if
    // they're touched by 2+ branches; single-branch files don't need a check.
    fileSeverity: Record<string, FileSeverity>;
    elapsedMs: number;
    cacheHits: number;
    cacheMisses: number;
}

// Progress events emitted during conflict analysis. The UI uses these to drive
// the live progress modal so the user knows the long-running work is moving.
export type ConflictProgress =
    | { phase: 'init' }
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
): Promise<LocalConflictReport> {
    const t0 = performance.now();
    const fs = makeFsApiFs(handle);
    const dir = '/';
    onProgress?.({ phase: 'init' });

    const defaultSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${defaultBranch}` });

    // Resolve every branch's HEAD up front so we can group by sha and skip
    // recomputing analysis for duplicates.
    const resolved: { name: string; sha: string; error: string | null }[] = [];
    const toResolve = branchesToCheck.filter((n) => n !== defaultBranch);
    for (let i = 0; i < toResolve.length; i++) {
        const name = toResolve[i];
        onProgress?.({ phase: 'resolving', current: i + 1, total: toResolve.length, branch: name });
        try {
            const sha = await git.resolveRef({ fs, dir, ref: `refs/heads/${name}` });
            resolved.push({ name, sha, error: null });
        } catch (e) {
            resolved.push({ name, sha: '', error: (e as Error).message });
        }
    }

    const groupsBySha = new Map<string, string[]>();
    for (const r of resolved) {
        if (r.error) continue;
        if (!groupsBySha.has(r.sha)) groupsBySha.set(r.sha, []);
        groupsBySha.get(r.sha)!.push(r.name);
    }
    const branchGroups: BranchGroup[] = [];
    for (const [sha, names] of groupsBySha) {
        const sorted = [...names].sort();
        branchGroups.push({ sha, branches: sorted, canonical: sorted[0] });
    }
    branchGroups.sort((a, b) => a.canonical.localeCompare(b.canonical));

    // Per-branch: merge-base + changed files. Both cached by SHA-pair keys —
    // valid as long as the involved SHAs are unchanged.
    const branchChanges: BranchChanges[] = [];
    for (let i = 0; i < branchGroups.length; i++) {
        const g = branchGroups[i];
        onProgress?.({ phase: 'branch-changes', current: i + 1, total: branchGroups.length, branch: g.canonical });
        const bc: BranchChanges = { branch: g.canonical, sha: g.sha, base: '', files: [], error: null };
        try {
            bc.base = await getOrComputeMergeBase(fs, dir, g.sha, defaultSha, cache);
            if (!bc.base) {
                bc.error = 'no merge base with default';
            } else {
                bc.files = await getOrComputeBranchFiles(fs, dir, g.sha, bc.base, cache);
            }
        } catch (e) {
            bc.error = (e as Error).message;
        }
        branchChanges.push(bc);
    }
    // Errored branches show up but don't participate in analysis.
    for (const r of resolved) {
        if (!r.error) continue;
        branchGroups.push({ sha: '', branches: [r.name], canonical: r.name });
        branchChanges.push({ branch: r.name, sha: '', base: '', files: [], error: r.error });
    }

    // Default-changed-since-base, cached per (defaultSha, baseSha).
    const branchVsDefault: BranchVsDefault[] = [];
    const uniqueBases = [...new Set(branchChanges.filter((b) => !b.error && b.base).map((b) => b.base))];
    let baseProgressIdx = 0;
    const defaultChangedByBase = new Map<string, string[]>();
    for (const bc of branchChanges) {
        if (bc.error || !bc.base) {
            branchVsDefault.push({
                branch: bc.branch, defaultChangedFiles: [], intersection: [],
                error: bc.error ?? 'no base',
            });
            continue;
        }
        let defaultChanged = defaultChangedByBase.get(bc.base);
        if (!defaultChanged) {
            baseProgressIdx++;
            onProgress?.({ phase: 'default-diff', current: baseProgressIdx, total: uniqueBases.length, base: bc.base });
            try {
                defaultChanged = await getOrComputeDefaultSinceBase(fs, dir, defaultSha, bc.base, cache);
                defaultChangedByBase.set(bc.base, defaultChanged);
            } catch (e) {
                branchVsDefault.push({
                    branch: bc.branch, defaultChangedFiles: [], intersection: [],
                    error: `default-since-base: ${(e as Error).message}`,
                });
                continue;
            }
        }
        const defaultSet = new Set(defaultChanged);
        branchVsDefault.push({
            branch: bc.branch,
            defaultChangedFiles: defaultChanged,
            intersection: bc.files.filter((f) => defaultSet.has(f)),
            error: null,
        });
    }

    const pairs: BranchPair[] = [];
    for (let i = 0; i < branchChanges.length; i++) {
        const a = branchChanges[i];
        if (a.error || a.files.length === 0) continue;
        const setA = new Set(a.files);
        for (let j = i + 1; j < branchChanges.length; j++) {
            const b = branchChanges[j];
            if (b.error || b.files.length === 0) continue;
            const inter = b.files.filter((f) => setA.has(f));
            if (inter.length > 0) pairs.push({ a: a.branch, b: b.branch, intersection: inter });
        }
    }
    pairs.sort((x, y) => y.intersection.length - x.intersection.length);

    const severityMap = await computeFileSeverity(handle, branchChanges, cache, onProgress);
    const fileSeverity: Record<string, FileSeverity> = {};
    for (const [f, s] of severityMap) fileSeverity[f] = s;

    const elapsedMs = Math.round(performance.now() - t0);
    onProgress?.({ phase: 'done', elapsedMs });

    return {
        defaultBranch, defaultSha, branchGroups, branchChanges, branchVsDefault, pairs, fileSeverity,
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
    const out: string[] = [];
    await git.walk({
        fs, dir,
        trees: [git.TREE({ ref: fromOid }), git.TREE({ ref: toOid })],
        map: async (filepath: string, entries: (git.WalkerEntry | null)[]) => {
            if (filepath === '.') return;
            const [a, b] = entries;
            if (!a && !b) return;
            const aType = a ? await a.type() : null;
            const bType = b ? await b.type() : null;
            if (aType === 'tree' || bType === 'tree') return;
            const aOid = a ? await a.oid() : null;
            const bOid = b ? await b.oid() : null;
            if (aOid === bOid) return;
            out.push(filepath);
        },
    });
    return out;
}
