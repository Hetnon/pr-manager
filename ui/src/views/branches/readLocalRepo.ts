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
    const startTime = performance.now();
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
    return { defaultBranch, currentBranch, branches, readMs: Math.round(performance.now() - startTime) };
}

async function readBranch(
    fs: Fs,
    dir: string,
    name: string,
    currentBranch: string | null,
    defaultBranch: string | null,
    defaultSha: string | null,
): Promise<LocalBranch> {
    const branch: LocalBranch = {
        name,
        sha: '',
        current: name === currentBranch,
        head: null,
        remoteSha: null,
        aheadOfDefault: 0,
        behindDefault: 0,
        truncated: false,
        error: null,
    };
    try {
        branch.sha = await git.resolveRef({ fs, dir, ref: `refs/heads/${name}` });
        const { commit } = await git.readCommit({ fs, dir, oid: branch.sha });
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

    if (!defaultBranch || !defaultSha || name === defaultBranch) return branch;

    try {
        const [base] = await git.findMergeBase({ fs, dir, oids: [defaultSha, branch.sha] });
        if (!base) {
            branch.error = 'no merge base with default';
            return branch;
        }
        const ahead = await countCommits(fs, dir, base, branch.sha);
        const behind = await countCommits(fs, dir, base, defaultSha);
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
