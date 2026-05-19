import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';

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

type Fs = ReturnType<typeof makeFsApiFs>;

export async function readLocalRepo(handle: FileSystemDirectoryHandle): Promise<LocalRepoSnapshot> {
    const t0 = performance.now();
    const fs = makeFsApiFs(handle);
    const dir = '/';

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

    const branches: LocalBranch[] = [];
    for (const name of branchNames) {
        branches.push(await readBranch(fs, dir, name, currentBranch, defaultBranch, defaultSha));
    }
    return { defaultBranch, currentBranch, branches, readMs: Math.round(performance.now() - t0) };
}

async function readBranch(
    fs: Fs,
    dir: string,
    name: string,
    currentBranch: string | null,
    defaultBranch: string | null,
    defaultSha: string | null,
): Promise<LocalBranch> {
    const out: LocalBranch = {
        name,
        sha: '',
        current: name === currentBranch,
        head: null,
        aheadOfDefault: 0,
        behindDefault: 0,
        truncated: false,
        error: null,
    };
    try {
        out.sha = await git.resolveRef({ fs, dir, ref: `refs/heads/${name}` });
        const { commit } = await git.readCommit({ fs, dir, oid: out.sha });
        out.head = {
            message: commit.message.split('\n')[0],
            authorName: commit.author.name,
            authorEmail: commit.author.email,
            date: new Date(commit.author.timestamp * 1000).toISOString(),
        };
    } catch (e) {
        out.error = `HEAD: ${(e as Error).message}`;
        return out;
    }

    if (!defaultBranch || !defaultSha || name === defaultBranch) return out;

    try {
        const [base] = await git.findMergeBase({ fs, dir, oids: [defaultSha, out.sha] });
        if (!base) {
            out.error = 'no merge base with default';
            return out;
        }
        const ahead = await countCommits(fs, dir, base, out.sha);
        const behind = await countCommits(fs, dir, base, defaultSha);
        out.aheadOfDefault = ahead.count;
        out.behindDefault = behind.count;
        out.truncated = ahead.truncated || behind.truncated;
    } catch (e) {
        out.error = `ahead/behind: ${(e as Error).message}`;
    }
    return out;
}

// Counts commits reachable from headOid but not equal to baseOid, capped at MAX.
// Feature branches almost never merge in commits older than their merge-base, so a
// straight parent walk stopped at base is correct for the common case. Replace with a
// proper bidirectional walk if we start tracking branches that backmerge old upstreams.
async function countCommits(
    fs: Fs,
    dir: string,
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
            const { commit } = await git.readCommit({ fs, dir, oid });
            for (const p of commit.parent) queue.push(p);
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
