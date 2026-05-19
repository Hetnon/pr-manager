import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';
import { proxiedGitHttp } from '../repo/gitHttpAdapter.js';

export type FetchResult =
    | { ok: true; fetchedAt: string; defaultBranch: string | null; prunedRefs: number }
    | { ok: false; error: string };

// Runs `git fetch --prune` against origin via the server proxy. Updates
// refs/remotes/origin/* and drops gone-away tracking refs. Does NOT touch the
// working tree or any local branches — pull is a separate concern.
export async function fetchOrigin(
    handle: FileSystemDirectoryHandle,
    owner: string,
    repo: string,
): Promise<FetchResult> {
    const fs = makeFsApiFs(handle);
    const url = `${apiBase()}/api/git-proxy/${owner}/${repo}`;
    try {
        const result = await git.fetch({
            fs,
            http: proxiedGitHttp,
            dir: '/',
            url,
            remote: 'origin',
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
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

function apiBase(): string {
    if (typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__) return __API_BASE_URL__;
    return '';
}
