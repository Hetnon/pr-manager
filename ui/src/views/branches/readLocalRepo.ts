import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../../adapters/fsApiAdapter.js';

export interface LocalBranchHead {
    message: string;
    authorName: string;
    authorEmail: string;
    date: string;
}

export interface LocalBranch {
    name: string;
    sha: string;
    current: boolean;
    head: LocalBranchHead | null;
    // SHA of refs/remotes/origin/<name>, or null if the branch has no
    // remote-tracking ref (i.e. it isn't on origin as of the last fetch).
    // Reflects the most recent fetch, so it can lag origin by one refresh.
    remoteSha: string | null;
    // True when the branch has upstream config (branch.<name>.merge) — i.e. it was
    // pushed/tracked at some point. Combined with remoteSha === null this means "was
    // on origin, now gone" (likely merged + deleted), vs a never-pushed local branch.
    hadUpstream: boolean;
    // How the local tip relates to origin/<name> (as of the last fetch):
    //   local-only — not on origin · synced — same commit · ahead — local has commits
    //   origin lacks · behind — origin has commits local lacks · diverged — both do.
    remoteRelation: 'local-only' | 'synced' | 'ahead' | 'behind' | 'diverged';
    aheadOfDefault: number;
    behindDefault: number;
    truncated: boolean;
    error: string | null;
}

export interface LocalRepoSnapshot {
    defaultBranch: string | null;
    currentBranch: string | null;
    branches: LocalBranch[];
    readMs: number;
}

const DEFAULT_BRANCH_CANDIDATES = ['main', 'master', 'develop'];
const MAX_AHEAD_BEHIND = 500;

// Branches read at once. The File System Access bridge has high per-op latency, so
// overlapping reads hides most of it. Safe with the shared cache: isomorphic-git stores
// each pack index as an in-flight promise BEFORE awaiting it, so concurrent reads of the
// same packfile await one parse instead of duplicating it. Capped so we don't flood the
// bridge with hundreds of simultaneous handle traversals.
const READ_CONCURRENCY = 8;

type Fs = ReturnType<typeof makeFsApiFs>;

// Reports read progress as branches complete: (branches done, total). Called once with
// (0, total) up front so a UI can show the total before any branch finishes.
export type ReadProgress = (done: number, total: number) => void;

// One isomorphic-git object cache PER repo folder, persisted across reads. Within a
// single read it stops the N-branch × M-commit walk from re-parsing the packfile(s) on
// every readCommit; persisting it means a re-read (remount, tab switch, Refresh) reuses
// those already-parsed pack indexes and inflated objects instead of paying the whole
// cold walk again over the slow File System Access bridge.
//
// It never needs invalidation. Git objects are immutable and content-addressed, and
// isomorphic-git re-runs readdir('objects/pack') on every object lookup while keying each
// parsed pack index by its (SHA-bearing) filename — so a fetch's NEW packfile is picked up
// automatically on the next read, and cached entries can only ever hold still-valid data.
// Keyed by handle identity, so a repo switch gets its own entry and dropped handles' caches
// are garbage-collected.
const repoCaches = new WeakMap<FileSystemDirectoryHandle, object>();

function getRepoCache(handle: FileSystemDirectoryHandle): object {
    let cache = repoCaches.get(handle);
    if (!cache) {
        cache = {};
        repoCaches.set(handle, cache);
    }
    return cache;
}

export async function readLocalRepo(
    handle: FileSystemDirectoryHandle,
    onProgress?: ReadProgress,
): Promise<LocalRepoSnapshot> {
    const startTime = performance.now();
    const fs = makeFsApiFs(handle);
    const dir = '/';
    const cache = getRepoCache(handle);

    const branchNames = await git.listBranches({ fs, dir });
    let currentBranch: string | null = null;
    try { currentBranch = (await git.currentBranch({ fs, dir })) ?? null; } catch { /* detached or empty */ }
    const defaultBranch = pickDefaultBranch(branchNames);

    let defaultSha: string | null = null;
    if (defaultBranch) {
        try {
            defaultSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${defaultBranch}` });
        } catch { /* leave null; per-branch ahead/behind will show errors */ }
    }

    // Which branches have upstream config (branch.<name>.merge), read ONCE. git.getConfig
    // re-reads and re-parses .git/config from disk on every call and isn't cache-backed, so
    // calling it per branch meant N sequential config reads over the slow bridge. One read
    // of the whole file, scanned for tracked branches, replaces all of them.
    const tracked = await readTrackedBranches(fs);

    const branches = await readBranchesConcurrently(
        branchNames,
        (name) => readBranch(fs, dir, cache, name, currentBranch, defaultBranch, defaultSha, tracked),
        onProgress,
    );
    return { defaultBranch, currentBranch, branches, readMs: Math.round(performance.now() - startTime) };
}

// Reads all branches through a fixed-size worker pool, preserving branchNames order in the
// result and reporting progress as each one finishes. A single branch's read never throws
// (readBranch catches into branch.error), so one slow/broken branch can't stall the pool.
async function readBranchesConcurrently(
    branchNames: string[],
    read: (name: string) => Promise<LocalBranch>,
    onProgress?: ReadProgress,
): Promise<LocalBranch[]> {
    const total = branchNames.length;
    const results: LocalBranch[] = new Array(total);
    let nextIndex = 0;
    let done = 0;
    onProgress?.(0, total);
    async function worker(): Promise<void> {
        while (true) {
            const index = nextIndex++;
            if (index >= total) return;
            results[index] = await read(branchNames[index]);
            onProgress?.(++done, total);
        }
    }
    const poolSize = Math.min(READ_CONCURRENCY, total);
    await Promise.all(Array.from({ length: poolSize }, () => worker()));
    return results;
}

// Set of branch names that have upstream config (a `merge = ...` under [branch "<name>"]).
// Parsed straight from .git/config in one read — the only bit of config readLocalRepo needs,
// and hadUpstream just asks "does branch.<name>.merge exist". A missing/unreadable config
// (e.g. a `.git` file for a worktree/submodule) yields an empty set: every branch reads as
// never-tracked, same as the old per-branch getConfig's catch fallback.
async function readTrackedBranches(fs: Fs): Promise<Set<string>> {
    let text: string;
    try {
        text = (await fs.promises.readFile('/.git/config', 'utf8')) as string;
    } catch {
        return new Set();
    }
    const tracked = new Set<string>();
    let section: string | null = null;
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        const header = line.match(/^\[branch\s+"(.+)"\]$/i);
        if (header) { section = header[1]; continue; }
        if (line.startsWith('[')) { section = null; continue; }
        if (section && /^merge\s*=/i.test(line)) tracked.add(section);
    }
    return tracked;
}

async function readBranch(
    fs: Fs,
    dir: string,
    cache: object,
    name: string,
    currentBranch: string | null,
    defaultBranch: string | null,
    defaultSha: string | null,
    tracked: Set<string>,
): Promise<LocalBranch> {
    const branch: LocalBranch = {
        name,
        sha: '',
        current: name === currentBranch,
        head: null,
        remoteSha: null,
        hadUpstream: false,
        remoteRelation: 'local-only',
        aheadOfDefault: 0,
        behindDefault: 0,
        truncated: false,
        error: null,
    };
    try {
        branch.sha = await git.resolveRef({ fs, dir, ref: `refs/heads/${name}` });
        const { commit } = await git.readCommit({ fs, dir, cache, oid: branch.sha });
        branch.head = {
            message: commit.message.split('\n')[0],
            authorName: commit.author.name,
            authorEmail: commit.author.email,
            date: new Date(commit.author.timestamp * 1000).toISOString(),
        };
    } catch (error) {
        branch.error = `HEAD: ${(error as Error).message}`;
        return branch;
    }

    // Whether (and where) the branch sits on origin. Populated by the last fetch;
    // absent ref = not on origin. Resolved for the default branch too, so its
    // status cell can report "on origin" instead of guessing "still local".
    try {
        branch.remoteSha = await git.resolveRef({ fs, dir, ref: `refs/remotes/origin/${name}` });
    } catch { /* no remote-tracking ref — branch isn't on origin as of last fetch */ }

    branch.hadUpstream = tracked.has(name);

    // Relate the local tip to origin/<name>: a merge-base tells us which side (if any)
    // has commits the other lacks. Cheap — just the base, no full commit count.
    if (branch.remoteSha) {
        if (branch.remoteSha === branch.sha) {
            branch.remoteRelation = 'synced';
        } else {
            try {
                const [base] = await git.findMergeBase({ fs, dir, cache, oids: [branch.sha, branch.remoteSha] });
                if (base === branch.remoteSha) branch.remoteRelation = 'ahead';
                else if (base === branch.sha) branch.remoteRelation = 'behind';
                else branch.remoteRelation = 'diverged';
            } catch { /* unreadable history — leave as the default 'synced' guess is wrong; mark diverged */
                branch.remoteRelation = 'diverged';
            }
        }
    }

    if (!defaultBranch || !defaultSha || name === defaultBranch) return branch;

    try {
        const [base] = await git.findMergeBase({ fs, dir, cache, oids: [defaultSha, branch.sha] });
        if (!base) {
            branch.error = 'no merge base with default';
            return branch;
        }
        const ahead = await countCommits(fs, dir, cache, base, branch.sha);
        const behind = await countCommits(fs, dir, cache, base, defaultSha);
        branch.aheadOfDefault = ahead.count;
        branch.behindDefault = behind.count;
        branch.truncated = ahead.truncated || behind.truncated;
    } catch (error) {
        branch.error = `ahead/behind: ${(error as Error).message}`;
    }
    return branch;
}

// Counts commits reachable from headOid but not equal to baseOid, capped at MAX.
// Feature branches almost never merge in commits older than their merge-base, so a
// straight parent walk stopped at base is correct for the common case. Replace with a
// proper bidirectional walk if we start tracking branches that backmerge old upstreams.
async function countCommits(
    fs: Fs,
    dir: string,
    cache: object,
    baseOid: string,
    headOid: string,
): Promise<{ count: number; truncated: boolean }> {
    if (baseOid === headOid) return { count: 0, truncated: false };
    const seen = new Set<string>();
    const queue: string[] = [headOid];
    let count = 0;
    while (queue.length) {
        const oid = queue.shift()!;
        if (oid === baseOid || seen.has(oid)) continue;
        seen.add(oid);
        count++;
        if (count >= MAX_AHEAD_BEHIND) return { count, truncated: true };
        try {
            const { commit } = await git.readCommit({ fs, dir, cache, oid });
            for (const parentOid of commit.parent) queue.push(parentOid);
        } catch { /* unreadable parent — stop this branch of the walk */ }
    }
    return { count, truncated: false };
}

function pickDefaultBranch(branches: string[]): string | null {
    for (const name of DEFAULT_BRANCH_CANDIDATES) {
        if (branches.includes(name)) return name;
    }
    return branches[0] ?? null;
}
