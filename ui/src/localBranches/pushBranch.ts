import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';
import { proxiedGitHttp } from '../repo/gitHttpAdapter.js';

export type PushResult =
    | { ok: true; ref: string }
    | { ok: false; error: string };

// Pushes the given branch through the server proxy, which attaches the user's
// OAuth token before forwarding to github.com. The browser never sees the token.
export async function pushBranch(
    handle: FileSystemDirectoryHandle,
    branch: string,
    owner: string,
    repo: string,
): Promise<PushResult> {
    const fs = makeFsApiFs(handle);
    const url = `${apiBase()}/api/git-proxy/${owner}/${repo}`;
    try {
        const result = await git.push({
            fs,
            http: proxiedGitHttp,
            dir: '/',
            url,
            ref: branch,
        });
        if (!result.ok) {
            const errs = (result as { errors?: string[] }).errors;
            return { ok: false, error: errs?.join('; ') ?? 'remote rejected push' };
        }
        return { ok: true, ref: branch };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

function apiBase(): string {
    if (typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__) return __API_BASE_URL__;
    return '';
}
