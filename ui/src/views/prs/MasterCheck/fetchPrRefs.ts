import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../../../repo/fsApiAdapter.js';
import { proxiedGitHttp } from '../../../repo/gitHttpAdapter.js';

export interface FetchPrRefsResult {
    fetched: number[];
    failed: { number: number; error: string }[];
}

// Fetches refs/pull/<N>/head into the local repo via the server proxy. Once
// done, the PR HEAD commits live in the local object database and can be
// addressed by SHA via readBlob/readCommit/findMergeBase/etc. Doesn't store a
// local branch — we just want the objects.
//
// Sequential through the proxy to avoid overwhelming it. For typical PR sets
// (<20) the total network cost is still seconds, not minutes.
export async function fetchPrRefs(
    handle: FileSystemDirectoryHandle,
    owner: string,
    repo: string,
    prNumbers: number[],
): Promise<FetchPrRefsResult> {
    const fs = makeFsApiFs(handle);
    const url = `${apiBase()}/api/git-proxy/${owner}/${repo}`;
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

function apiBase(): string {
    if (typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__) return __API_BASE_URL__;
    return '';
}
