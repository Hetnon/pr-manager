import * as git from 'isomorphic-git';
import type { TreeEntry } from 'isomorphic-git';
import { makeFsApiFs } from '../../../repo/fsApiAdapter.js';

type Fs = ReturnType<typeof makeFsApiFs>;

export interface DedupResult {
    dedupBranch: string;
    reverted: number;   // files reset to their base content
    deleted: number;    // files the branch newly added → removed entirely
    sha: string;        // the new commit
}

// An override applied to a path while rebuilding the tree: a base blob oid to
// revert to, or null to delete the entry outright (file didn't exist in base).
type Override = string | null;

/**
 * Creates (or overwrites) a local `‹branch›-dedup` branch: a copy of `branch`'s
 * HEAD with `files` reverted to the branch's merge-base content — or deleted if
 * the branch newly added them. Those files then drop out of the dedup branch's
 * diff vs the default branch, so merging it won't carry or re-diff them.
 *
 * Pure object-level git (build tree → write commit → write ref): the working
 * tree and index are never touched. The original branch is left untouched.
 * Requires readwrite folder permission.
 */
export async function createDedupBranch(
    handle: FileSystemDirectoryHandle,
    branch: string,
    headSha: string,
    baseSha: string,
    files: string[],
): Promise<DedupResult> {
    const fs = makeFsApiFs(handle);
    const dir = '/';

    // Resolve each file's base content: its blob oid at the merge-base, or a
    // delete if it didn't exist there. Reads run in parallel.
    const baseOids = await Promise.all(files.map((file) => tryBlobOid(fs, dir, baseSha, file)));
    const overrides = new Map<string, Override>();
    let reverted = 0;
    let deleted = 0;
    files.forEach((file, i) => {
        const baseOid = baseOids[i];
        if (baseOid === null) {
            overrides.set(file, null);
            deleted++;
        } else {
            overrides.set(file, baseOid);
            reverted++;
        }
    });

    const { commit } = await git.readCommit({ fs, dir, oid: headSha });
    const newTree = (await rebuildTree(fs, dir, commit.tree, '', overrides)) ?? (await git.writeTree({ fs, dir, tree: [] }));

    const now = Math.floor(Date.now() / 1000);
    const identity = { name: 'pr-matrix', email: 'pr-matrix@local', timestamp: now, timezoneOffset: new Date().getTimezoneOffset() };
    const sha = await git.writeCommit({
        fs, dir,
        commit: {
            message: `pr-matrix: drop ${files.length} file(s) identical to other branches\n\nReverted to the merge-base so they no longer appear in this branch's diff.\n`,
            tree: newTree,
            parent: [headSha],
            author: identity,
            committer: identity,
        },
    });

    const dedupBranch = `${branch}${DEDUP_SUFFIX}`;
    await git.writeRef({ fs, dir, ref: `refs/heads/${dedupBranch}`, value: sha, force: true });

    return { dedupBranch, reverted, deleted, sha };
}

// Rebuilds `treeOid`, applying `overrides` (keyed by full path). Recurses only
// into subtrees that contain an override. Returns the new tree oid, or null if
// the (sub)tree ends up empty so the caller can drop it.
async function rebuildTree(
    fs: Fs, dir: string,
    treeOid: string, prefix: string,
    overrides: Map<string, Override>,
): Promise<string | null> {
    const { tree } = await git.readTree({ fs, dir, oid: treeOid });
    const newEntries: TreeEntry[] = [];

    for (const entry of tree) {
        const fullPath = prefix ? `${prefix}/${entry.path}` : entry.path;
        if (entry.type === 'tree') {
            const touched = anyUnder(overrides, fullPath);
            if (!touched) { newEntries.push(entry); continue; }
            const rebuilt = await rebuildTree(fs, dir, entry.oid, fullPath, overrides);
            if (rebuilt) newEntries.push({ ...entry, oid: rebuilt });
            // null → subtree emptied out, drop it
        } else {
            const override = overrides.get(fullPath);
            if (override === undefined) newEntries.push(entry);          // untouched file
            else if (override === null) { /* delete: omit */ }
            else newEntries.push({ ...entry, oid: override });           // revert content, keep mode
        }
    }

    if (newEntries.length === 0) return null;
    return git.writeTree({ fs, dir, tree: newEntries });
}

function anyUnder(overrides: Map<string, Override>, dirPath: string): boolean {
    const prefix = `${dirPath}/`;
    for (const key of overrides.keys()) {
        if (key === dirPath || key.startsWith(prefix)) return true;
    }
    return false;
}

// Suffix used for the local deduplicated copy of a branch.
export const DEDUP_SUFFIX = '-dedup';

/**
 * Folds `‹branch›-dedup` back onto its original: fast-forwards `original` to the
 * dedup commit and deletes the dedup ref, so there's a single branch (the
 * original name) carrying the deduplicated content. The dedup commit's parent is
 * the original's HEAD, so this is a true fast-forward (no force, history kept) —
 * we verify that and refuse if the original moved since dedup.
 */
export async function foldDedupIntoOriginal(
    handle: FileSystemDirectoryHandle,
    dedupBranch: string,
    originalBranch: string,
): Promise<{ sha: string }> {
    const fs = makeFsApiFs(handle);
    const dir = '/';

    const dedupSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${dedupBranch}` });
    const originalSha = await git.resolveRef({ fs, dir, ref: `refs/heads/${originalBranch}` });
    const { commit } = await git.readCommit({ fs, dir, oid: dedupSha });
    if (!commit.parent.includes(originalSha)) {
        throw new Error(`${originalBranch} moved since dedup — can't fast-forward cleanly. Re-run dedup.`);
    }

    await git.writeRef({ fs, dir, ref: `refs/heads/${originalBranch}`, value: dedupSha, force: true });
    await git.deleteRef({ fs, dir, ref: `refs/heads/${dedupBranch}` });
    return { sha: dedupSha };
}

async function tryBlobOid(fs: Fs, dir: string, commitOid: string, filepath: string): Promise<string | null> {
    try {
        const { oid } = await git.readBlob({ fs, dir, oid: commitOid, filepath });
        return oid;
    } catch {
        return null;
    }
}
