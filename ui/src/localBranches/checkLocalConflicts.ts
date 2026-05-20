import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';
import { computeFileSeverity, type FileSeverity } from './lineLevelConflicts.js';

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
    onProgress?: ConflictProgressCallback,
): Promise<LocalConflictReport> {
    const t0 = performance.now();
    const fs = makeFsApiFs(handle);
    const dir = '/';
    onProgress?.({ phase: 'init' });

    const defaultSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${defaultBranch}` });

    // Resolve every branch's HEAD up front so we can group by sha and skip
    // recomputing analysis for duplicates (a common pattern when several agents
    // converge on the same merge commit).
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

    // Group by sha. Errored branches each get their own group (sha = '') so the
    // UI can still surface them but they don't pollute the dedup.
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

    // Run the expensive per-branch analysis only on canonicals.
    const branchChanges: BranchChanges[] = [];
    for (let i = 0; i < branchGroups.length; i++) {
        const g = branchGroups[i];
        onProgress?.({ phase: 'branch-changes', current: i + 1, total: branchGroups.length, branch: g.canonical });
        const bc: BranchChanges = { branch: g.canonical, sha: g.sha, base: '', files: [], error: null };
        try {
            const [base] = await git.findMergeBase({ fs, dir, oids: [defaultSha, g.sha] });
            if (!base) {
                bc.error = 'no merge base with default';
            } else {
                bc.base = base;
                bc.files = await changedFiles(fs, dir, base, g.sha);
            }
        } catch (e) {
            bc.error = (e as Error).message;
        }
        branchChanges.push(bc);
    }
    // Carry forward errored (unresolvable) branches as their own pseudo-groups
    // so they show up in the report without participating in analysis.
    for (const r of resolved) {
        if (!r.error) continue;
        branchGroups.push({ sha: '', branches: [r.name], canonical: r.name });
        branchChanges.push({ branch: r.name, sha: '', base: '', files: [], error: r.error });
    }

    // Cache "files default changed since base" by base sha — usually all branches share
    // one base (default = base for newly-branched work), so we only pay this once.
    const defaultChangedCache = new Map<string, string[]>();
    const branchVsDefault: BranchVsDefault[] = [];
    const uniqueBases = [...new Set(branchChanges.filter((b) => !b.error && b.base).map((b) => b.base))];
    let baseProgressIdx = 0;
    for (const bc of branchChanges) {
        if (bc.error || !bc.base) {
            branchVsDefault.push({
                branch: bc.branch, defaultChangedFiles: [], intersection: [],
                error: bc.error ?? 'no base',
            });
            continue;
        }
        let defaultChanged = defaultChangedCache.get(bc.base);
        if (!defaultChanged) {
            baseProgressIdx++;
            onProgress?.({ phase: 'default-diff', current: baseProgressIdx, total: uniqueBases.length, base: bc.base });
            try {
                defaultChanged = await changedFiles(fs, dir, bc.base, defaultSha);
                defaultChangedCache.set(bc.base, defaultChanged);
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

    const severityMap = await computeFileSeverity(handle, branchChanges, onProgress);
    const fileSeverity: Record<string, FileSeverity> = {};
    for (const [f, s] of severityMap) fileSeverity[f] = s;

    const elapsedMs = Math.round(performance.now() - t0);
    onProgress?.({ phase: 'done', elapsedMs });

    return {
        defaultBranch, defaultSha, branchGroups, branchChanges, branchVsDefault, pairs, fileSeverity,
        elapsedMs,
    };
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
            // Let walker descend into trees; only emit on blob differences.
            if (aType === 'tree' || bType === 'tree') return;
            const aOid = a ? await a.oid() : null;
            const bOid = b ? await b.oid() : null;
            if (aOid === bOid) return;
            out.push(filepath);
        },
    });
    return out;
}
