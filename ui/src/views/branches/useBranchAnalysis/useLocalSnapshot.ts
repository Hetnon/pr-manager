import { useContext, useEffect, useState } from 'react';
import { RepoContext } from '../../../repo/RepoContext.js';
import { readLocalRepo, type LocalRepoSnapshot } from '../readLocalRepo.js';
import { fetchOrigin, type FetchResult } from '../../../api/git.js';

// Reads the local repo into a branch snapshot, then does an opportunistic origin
// fetch + prune. Folder read+write is guaranteed by the app's entry gate.
export function useLocalSnapshot(refreshNonce: number) {
    const { currentRepoFolderHandle, currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const [snapshot, setSnapshot] = useState<LocalRepoSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [lastFetch, setLastFetch] = useState<FetchResult | null>(null);

    async function load(targetFolder: FileSystemDirectoryHandle) {
        setBusy(true);
        setError(null);
        try {
            setSnapshot(await readLocalRepo(targetFolder));
        } catch (caughtError) {
            setError(caughtError instanceof Error ? `${caughtError.name}: ${caughtError.message}` : String(caughtError));
        } finally {
            setBusy(false);
        }
    }

    // We deliberately DON'T reread after the fetch: the local-branch data (heads,
    // ahead/behind, commits) is unchanged by a fetch, and rereading would repeat the
    // commit walk. The snapshot's remoteSha reflects refs/remotes/origin/* as of the
    // PREVIOUS fetch, so on-origin status can lag by one refresh — an accepted tradeoff.
    async function runRefresh(targetFolder: FileSystemDirectoryHandle) {
        await load(targetFolder);
        if (!owner || !repo) return;
        setFetching(true);
        try {
            setLastFetch(await fetchOrigin(targetFolder, owner, repo));
        } finally {
            setFetching(false);
        }
    }

    useEffect(() => {
        if (!currentRepoFolderHandle) {
            setSnapshot(null);
            setError(null);
            return;
        }
        void runRefresh(currentRepoFolderHandle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentRepoFolderHandle, refreshNonce]);

    return { snapshot, error, busy, fetching, lastFetch, refresh: runRefresh };
}
