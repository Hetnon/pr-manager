// Throwaway spike — verify isomorphic-git works against an FSAPI handle for the operations
// the local-git architecture needs: listing branches, resolving HEADs, finding merge bases,
// and detecting merge conflicts. Delete once Phase 1 starts.

import * as git from 'isomorphic-git';
import { makeFsApiFs } from './fsApiAdapter.js';

export interface SpikeResult {
    branches: { name: string; sha: string }[];
    currentBranch: string | null;
    defaultBranch: string | null;
    packDiag: { dir: string[]; files: { name: string; size: number | null; error: string | null }[]; error?: string };
    historyProbe: {
        branch: string;
        depthRequested: number;
        commitsRead: number;
        firstSha: string | null;
        oldestSha: string | null;
        error: string | null;
    }[];
    treeDiffProbe: {
        ours: string;
        theirs: string;
        oursSha: string;
        theirsSha: string;
        mergeBase: string | null;
        filesChangedInOurs: number;
        filesChangedInTheirs: number;
        intersectingFiles: string[];
        error: string | null;
        notes: string;
    } | null;
    mergeProbe: {
        ours: string;
        theirs: string;
        mergeBase: string | null;
        wouldConflict: boolean | null;
        conflictedFiles: string[];
        notes: string;
    } | null;
    timings: Record<string, number>;
}

export async function runGitSpike(handle: FileSystemDirectoryHandle): Promise<SpikeResult> {
    const fs = makeFsApiFs(handle);
    const dir = '/';
    const timings: Record<string, number> = {};

    const t0 = performance.now();
    const branches = await git.listBranches({ fs, dir });
    timings.listBranches = performance.now() - t0;

    const t1 = performance.now();
    const branchesWithSha: { name: string; sha: string }[] = [];
    for (const name of branches) {
        try {
            const sha = await git.resolveRef({ fs, dir, ref: `refs/heads/${name}` });
            branchesWithSha.push({ name, sha });
        } catch (e) {
            branchesWithSha.push({ name, sha: `<unresolved: ${(e as Error).message}>` });
        }
    }
    timings.resolveAllHeads = performance.now() - t1;

    const t2 = performance.now();
    let currentBranch: string | null = null;
    try { currentBranch = await git.currentBranch({ fs, dir }) ?? null; } catch { /* detached or empty */ }
    timings.currentBranch = performance.now() - t2;

    const defaultBranch = pickDefaultBranch(branches);

    // Granular pack-file diagnostic. isomorphic-git's fs.read() wrapper swallows errors and
    // returns null, then GitPackIndex.fromIdx({idx: null}) crashes with the null.slice we saw.
    // So probe my adapter directly — list pack dir, then readFile each .idx — and surface the
    // exact failure on console.
    type PackDiag = { name: string; size: number | null; error: string | null };
    const packDiag: { dir: string[]; files: PackDiag[]; error?: string } = { dir: [], files: [] };
    try {
        const fsp = fs.promises;
        packDiag.dir = await fsp.readdir('/.git/objects/pack');
        for (const name of packDiag.dir) {
            if (!name.endsWith('.idx')) continue;
            const entry: PackDiag = { name, size: null, error: null };
            try {
                const buf = await fsp.readFile(`/.git/objects/pack/${name}`);
                entry.size = (buf as Uint8Array).byteLength;
            } catch (e) {
                entry.error = `${(e as Error).name}: ${(e as Error).message}`;
            }
            packDiag.files.push(entry);
        }
    } catch (e) {
        packDiag.error = `${(e as Error).name}: ${(e as Error).message}`;
    }
    // Surface to console so user can paste.
    // eslint-disable-next-line no-console
    console.log('[spike] pack diagnostic:', packDiag);
    (window as unknown as { __spike?: unknown }).__spike = packDiag;
    timings['packDiag:fileCount'] = packDiag.files.length;

    const historyProbe: SpikeResult['historyProbe'] = [];
    const branchesToProbe = [defaultBranch, currentBranch].filter((b): b is string => !!b);
    for (const b of branchesToProbe) {
        const tH = performance.now();
        const probe: SpikeResult['historyProbe'][number] = {
            branch: b, depthRequested: 5, commitsRead: 0, firstSha: null, oldestSha: null, error: null,
        };
        try {
            // First, narrow it down: can we read the single HEAD commit object?
            const headSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${b}` });
            probe.firstSha = headSha;
            try {
                const commit = await git.readCommit({ fs, dir, oid: headSha });
                probe.commitsRead = 1;
                probe.oldestSha = commit.commit.parent[0] ?? headSha;
            } catch (e) {
                probe.error = `readCommit(${headSha.slice(0, 12)}): ${(e as Error).message}`;
                throw e;
            }
            // Then try the broader log walk.
            const log = await git.log({ fs, dir, ref: b, depth: 5 });
            probe.commitsRead = log.length;
            probe.oldestSha = log[log.length - 1]?.oid ?? null;
        } catch (e) {
            if (!probe.error) probe.error = `log: ${(e as Error).message}`;
        }
        timings[`log:${b}`] = performance.now() - tH;
        historyProbe.push(probe);
    }

    let treeDiffProbe: SpikeResult['treeDiffProbe'] = null;
    let mergeProbe: SpikeResult['mergeProbe'] = null;
    const ours = defaultBranch;
    const theirs = currentBranch && currentBranch !== defaultBranch
        ? currentBranch
        : branches.find((b) => b !== defaultBranch) ?? null;
    if (ours && theirs) {
        treeDiffProbe = await probeTreeDiff(fs, dir, ours, theirs);
        timings.treeDiffProbe = treeDiffProbe ? Math.round(performance.now() - performance.now()) : 0;
        mergeProbe = await probeMerge(fs, dir, ours, theirs);
    }

    return { branches: branchesWithSha, currentBranch, defaultBranch, packDiag, historyProbe, treeDiffProbe, mergeProbe, timings };
}

async function probeTreeDiff(
    fs: ReturnType<typeof makeFsApiFs>,
    dir: string,
    ours: string,
    theirs: string,
): Promise<SpikeResult['treeDiffProbe']> {
    const t0 = performance.now();
    let oursSha = '', theirsSha = '', mergeBase: string | null = null;
    try {
        oursSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${ours}` });
        theirsSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${theirs}` });
        const bases = await git.findMergeBase({ fs, dir, oids: [oursSha, theirsSha] });
        mergeBase = bases[0] ?? null;
    } catch (e) {
        return {
            ours, theirs, oursSha, theirsSha, mergeBase: null,
            filesChangedInOurs: 0, filesChangedInTheirs: 0, intersectingFiles: [],
            error: (e as Error).message, notes: `findMergeBase failed in ${(performance.now() - t0).toFixed(0)}ms`,
        };
    }

    if (!mergeBase) {
        return {
            ours, theirs, oursSha, theirsSha, mergeBase: null,
            filesChangedInOurs: 0, filesChangedInTheirs: 0, intersectingFiles: [],
            error: 'no merge base', notes: `no common ancestor; refs resolved: ours=${oursSha.slice(0, 12)} theirs=${theirsSha.slice(0, 12)}`,
        };
    }

    try {
        const oursChanged = await changedFilesBetween(fs, dir, mergeBase, oursSha);
        const theirsChanged = await changedFilesBetween(fs, dir, mergeBase, theirsSha);
        const intersection = oursChanged.filter((f) => theirsChanged.includes(f));
        return {
            ours, theirs, oursSha, theirsSha, mergeBase,
            filesChangedInOurs: oursChanged.length,
            filesChangedInTheirs: theirsChanged.length,
            intersectingFiles: intersection.slice(0, 20),
            error: null,
            notes: `tree diff in ${(performance.now() - t0).toFixed(0)}ms`,
        };
    } catch (e) {
        return {
            ours, theirs, oursSha, theirsSha, mergeBase,
            filesChangedInOurs: 0, filesChangedInTheirs: 0, intersectingFiles: [],
            error: (e as Error).message, notes: `tree diff threw in ${(performance.now() - t0).toFixed(0)}ms`,
        };
    }
}

async function changedFilesBetween(
    fs: ReturnType<typeof makeFsApiFs>,
    dir: string,
    fromOid: string,
    toOid: string,
): Promise<string[]> {
    const changed: string[] = [];
    await git.walk({
        fs, dir, trees: [git.TREE({ ref: fromOid }), git.TREE({ ref: toOid })],
        map: async (filepath: string, entries: ((git.WalkerEntry | null))[]) => {
            if (filepath === '.') return;
            const [a, b] = entries;
            if (!a && !b) return;
            const aOid = a ? await a.oid() : null;
            const bOid = b ? await b.oid() : null;
            if (aOid === bOid) return;
            const aType = a ? await a.type() : null;
            const bType = b ? await b.type() : null;
            if (aType === 'tree' || bType === 'tree') return;
            changed.push(filepath);
        },
    });
    return changed;
}

function pickDefaultBranch(branches: string[]): string | null {
    for (const name of ['main', 'master', 'develop']) {
        if (branches.includes(name)) return name;
    }
    return branches[0] ?? null;
}

async function probeMerge(
    fs: ReturnType<typeof makeFsApiFs>,
    dir: string,
    ours: string,
    theirs: string,
): Promise<SpikeResult['mergeProbe']> {
    const t0 = performance.now();
    let mergeBase: string | null = null;
    try {
        const bases = await git.findMergeBase({ fs, dir, oids: [
            await git.resolveRef({ fs, dir, ref: `refs/heads/${ours}` }),
            await git.resolveRef({ fs, dir, ref: `refs/heads/${theirs}` }),
        ] });
        mergeBase = bases[0] ?? null;
    } catch (e) {
        return {
            ours, theirs, mergeBase: null, wouldConflict: null, conflictedFiles: [],
            notes: `findMergeBase failed: ${(e as Error).message} (took ${(performance.now() - t0).toFixed(0)}ms)`,
        };
    }

    let wouldConflict = false;
    const conflictedFiles: string[] = [];
    let notes = `merge-base resolved in ${(performance.now() - t0).toFixed(0)}ms`;

    const t1 = performance.now();
    try {
        await git.merge({ fs, dir, ours, theirs, dryRun: true, abortOnConflict: true, author: { name: 'spike', email: 'spike@local' } });
        notes += `; dryRun no conflict in ${(performance.now() - t1).toFixed(0)}ms`;
    } catch (e) {
        const err = e as { code?: string; data?: { filepaths?: string[] }; message?: string };
        if (err.code === 'MergeConflictError' || err.code === 'MergeNotSupportedError') {
            wouldConflict = err.code === 'MergeConflictError';
            if (err.data?.filepaths) conflictedFiles.push(...err.data.filepaths);
            notes += `; ${err.code} in ${(performance.now() - t1).toFixed(0)}ms`;
        } else {
            notes += `; merge dryRun threw ${err.code ?? 'unknown'}: ${err.message ?? String(e)}`;
            wouldConflict = false;
        }
    }

    return { ours, theirs, mergeBase, wouldConflict, conflictedFiles, notes };
}
