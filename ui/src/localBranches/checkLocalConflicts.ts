import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';

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

export interface LocalConflictReport {
    defaultBranch: string;
    defaultSha: string;
    branchChanges: BranchChanges[];
    branchVsDefault: BranchVsDefault[];
    pairs: BranchPair[];
    elapsedMs: number;
}

export async function checkLocalConflicts(
    handle: FileSystemDirectoryHandle,
    defaultBranch: string,
    branchesToCheck: string[],
): Promise<LocalConflictReport> {
    const t0 = performance.now();
    const fs = makeFsApiFs(handle);
    const dir = '/';

    const defaultSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${defaultBranch}` });

    const branchChanges: BranchChanges[] = [];
    for (const name of branchesToCheck) {
        if (name === defaultBranch) continue;
        const bc: BranchChanges = { branch: name, sha: '', base: '', files: [], error: null };
        try {
            bc.sha = await git.resolveRef({ fs, dir, ref: `refs/heads/${name}` });
            const [base] = await git.findMergeBase({ fs, dir, oids: [defaultSha, bc.sha] });
            if (!base) {
                bc.error = 'no merge base with default';
            } else {
                bc.base = base;
                bc.files = await changedFiles(fs, dir, base, bc.sha);
            }
        } catch (e) {
            bc.error = (e as Error).message;
        }
        branchChanges.push(bc);
    }

    // Cache "files default changed since base" by base sha — usually all branches share
    // one base (default = base for newly-branched work), so we only pay this once.
    const defaultChangedCache = new Map<string, string[]>();
    const branchVsDefault: BranchVsDefault[] = [];
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

    return {
        defaultBranch, defaultSha, branchChanges, branchVsDefault, pairs,
        elapsedMs: Math.round(performance.now() - t0),
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
