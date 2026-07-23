import * as git from 'isomorphic-git';
import { API_BASE } from './client.js';
import { makeFsApiFs } from '../adapters/fsApiAdapter.js';
import { proxiedGitHttp } from '../adapters/gitHttpAdapter.js';

// isomorphic-git operations that reach GitHub through our server's git proxy: the
// browser can't call GitHub directly, so the server attaches the user's OAuth token
// and forwards. These hit our server at the SAME API base the REST client uses
// (api/client.ts) — every UI→server call resolves to one server, never to GitHub.
function gitProxyUrl(owner: string, repo: string): string {
    return `${API_BASE}/api/git-proxy/${owner}/${repo}`;
}

export type PushResult =
    | { ok: true; ref: string }
    | { ok: false; error: string };

// Pushes the given branch to origin. A branch with an open PR updates that PR.
export async function gitPushBranch(
    handle: FileSystemDirectoryHandle,
    branch: string,
    owner: string,
    repo: string,
): Promise<PushResult> {
    const fs = makeFsApiFs(handle);
    try {
        const result = await git.push({
            fs,
            http: proxiedGitHttp,
            dir: '/',
            url: gitProxyUrl(owner, repo),
            ref: branch,
        });
        if (!result.ok) {
            const pushErrors = (result as { errors?: string[] }).errors;
            return { ok: false, error: pushErrors?.join('; ') ?? 'remote rejected push' };
        }
        return { ok: true, ref: branch };
    } catch (error) {
        return { ok: false, error: (error as Error).message };
    }
}

export type CheckoutResult = { ok: true } | { ok: false; error: string };
export type CheckoutProgress = { phase: string; loaded: number; total: number };

// Switch the working tree to `ref` (a local branch). Purely local — no network.
// isomorphic-git refuses (throws) if uncommitted changes would be overwritten, so
// a dirty tree can't be silently clobbered; callers should still pre-check clean.
//
// This rewrites every working-tree file that differs between the two branches,
// one file at a time over the File System Access bridge — so it can be slow for a
// branch far from its target. A shared cache avoids re-parsing packfiles per object,
// and onProgress lets the caller show it's alive rather than frozen.
export async function checkoutLocalBranch(
    handle: FileSystemDirectoryHandle,
    ref: string,
    onProgress?: (progress: CheckoutProgress) => void,
): Promise<CheckoutResult> {
    const fs = makeFsApiFs(handle);
    try {
        await git.checkout({ fs, dir: '/', ref, cache: {}, onProgress });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: (error as Error).message };
    }
}

// Delete the CURRENT branch without a working-tree rewrite: detach HEAD onto the
// commit the branch already points at (noCheckout ⇒ HEAD moves, files untouched),
// then delete the ref. Ends on a detached HEAD at the same commit — the working tree
// is byte-for-byte unchanged. This is the fast alternative to checking out another
// branch first (which would rewrite every differing file).
export async function detachHeadAndDeleteBranch(
    handle: FileSystemDirectoryHandle,
    branch: string,
    sha: string,
): Promise<CheckoutResult> {
    const fs = makeFsApiFs(handle);
    try {
        await git.checkout({ fs, dir: '/', ref: sha, noCheckout: true, cache: {} });
        await git.deleteBranch({ fs, dir: '/', ref: branch });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: (error as Error).message };
    }
}

export type FetchResult =
    | { ok: true; fetchedAt: string; defaultBranch: string | null; prunedRefs: number }
    | { ok: false; error: string };

// `git fetch --prune` against origin: updates refs/remotes/origin/* and drops
// gone-away tracking refs. Does NOT touch the working tree or local branches.
export async function fetchOrigin(
    handle: FileSystemDirectoryHandle,
    owner: string,
    repo: string,
): Promise<FetchResult> {
    const fs = makeFsApiFs(handle);
    try {
        const result = await git.fetch({
            fs,
            http: proxiedGitHttp,
            dir: '/',
            url: gitProxyUrl(owner, repo),
            remote: 'origin',
            // Key the fetch off the remote's HEAD (always advertised) rather than
            // letting isomorphic-git default to the local current branch's upstream.
            // A branch whose configured upstream (branch.<name>.merge) no longer
            // matches a remote-advertised ref would otherwise abort the whole fetch
            // with "Could not find refs/heads/<branch>". singleBranch stays false, so
            // all refs/remotes/origin/* are still updated and pruned.
            ref: 'HEAD',
            prune: true,
            pruneTags: true,
            tags: true,
        });
        return {
            ok: true,
            fetchedAt: new Date().toISOString(),
            defaultBranch: result.defaultBranch ?? null,
            prunedRefs: (result.pruned ?? []).length,
        };
    } catch (error) {
        return { ok: false, error: (error as Error).message };
    }
}

export interface FetchPrRefsResult {
    fetched: number[];
    failed: { number: number; error: string }[];
}

// git → specific PR head commits that a plain fetch skips
export async function fetchPrRefs(
    handle: FileSystemDirectoryHandle,
    owner: string,
    repo: string,
    prNumbers: number[],
): Promise<FetchPrRefsResult> {
    const fs = makeFsApiFs(handle);
    const url = gitProxyUrl(owner, repo);
    const fetched: number[] = [];
    const failed: { number: number; error: string }[] = [];
    for (const prNumber of prNumbers) {
        try {
            await git.fetch({
                fs,
                http: proxiedGitHttp,
                dir: '/',
                url,
                remoteRef: `refs/pull/${prNumber}/head`,
                singleBranch: true,
                tags: false,
            });
            fetched.push(prNumber);
        } catch (error) {
            failed.push({ number: prNumber, error: (error as Error).message });
        }
    }
    return { fetched, failed };
}
