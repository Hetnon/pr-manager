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
    // How far the current branch read has gotten (done/total), or null when not reading.
    const [readProgress, setReadProgress] = useState<{ done: number; total: number } | null>(null);
    const [fetching, setFetching] = useState(false);
    // Single flag held for the WHOLE runRefresh (read + fetch). Unlike busy/fetching,
    // which briefly both drop between the two phases, this never gaps — so a completion
    // watcher can trust "!refreshing" to mean the whole cycle is done.
    const [refreshing, setRefreshing] = useState(false);
    const [lastFetch, setLastFetch] = useState<FetchResult | null>(null);

    async function load(targetFolder: FileSystemDirectoryHandle) {
        setBusy(true);
        setError(null);
        setReadProgress(null);
        try {
            setSnapshot(await readLocalRepo(targetFolder, (done, total) => setReadProgress({ done, total })));
        } catch (caughtError) {
            setError(caughtError instanceof Error ? `${caughtError.name}: ${caughtError.message}` : String(caughtError));
        } finally {
            setBusy(false);
            setReadProgress(null);
        }
    }

    // We deliberately DON'T reread after the fetch: the local-branch data (heads,
    // ahead/behind, commits) is unchanged by a fetch, and rereading would repeat the
    // commit walk. The snapshot's remoteSha reflects refs/remotes/origin/* as of the
    // PREVIOUS fetch, so on-origin status can lag by one refresh — an accepted tradeoff.
    async function runRefresh(targetFolder: FileSystemDirectoryHandle) {
        setRefreshing(true);
        setLastFetch(null); // drop the previous cycle's result so status UIs don't show it as "current"
        try {
            await load(targetFolder);
            if (!owner || !repo) return;
            setFetching(true);
            try {
                setLastFetch(await fetchOrigin(targetFolder, owner, repo));
            } finally {
                setFetching(false);
            }
        } finally {
            setRefreshing(false);
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

    return { snapshot, error, busy, readProgress, fetching, refreshing, lastFetch, refresh: runRefresh };
}
