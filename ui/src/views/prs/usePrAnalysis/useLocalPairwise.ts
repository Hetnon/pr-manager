import { useContext, useEffect, useState } from 'react';
import type { PR } from '@shared/pr.js';
import type { PairwisePrConflicts } from '@shared/conflicts.js';
import { RepoContext } from '../../../repo/RepoContext.js';
import { fetchPrRefs } from '../fetchPrRefs.js';
import { computeBrowserPairwise } from '../computeBrowserPairwise.js';
import { loadCachedPairwise, saveCachedPairwise, prSetKey } from '../../../analysis/prCache.js';
import type { LocalPairwiseState } from '../types.js';

// Browser-side pairwise conflict detection between the candidate PRs. Fetches
// refs/pull/<N>/head for each, then runs a 3-way merge per shared file. Folder
// read+write access is guaranteed by the app's entry gate, so we just compute.
export function useLocalPairwise(
    prs: PR[],
    readyToCheck: PR[],
    promoted: Set<number>,
) {
    const { currentRepoFolderHandle, currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const [localPairwise, setLocalPairwise] = useState<LocalPairwiseState>({ phase: 'idle' });

    useEffect(() => {
        if (readyToCheck.length === 0 || !owner || !repo) { setLocalPairwise({ phase: 'idle' }); return; }
        // The pairwise verdict is a pure function of the candidate PRs' head shas
        // (3-way merges over immutable git objects), so a cache hit is trusted
        // outright — no fetch, no recompute, no revalidation. This is what makes a
        // page reload with unchanged PRs instant.
        const slug = `${owner}/${repo}`;
        const key = prSetKey(readyToCheck);
        const cached = loadCachedPairwise(slug, key);
        if (cached) { setLocalPairwise({ phase: 'ready', pairwise: cached, failedFetches: [] }); return; }
        if (!currentRepoFolderHandle) { setLocalPairwise({ phase: 'no-folder' }); return; }
        let cancelled = false;
        (async () => {
            const prNumbers = readyToCheck.map((pr) => pr.number);
            setLocalPairwise({ phase: 'fetching', total: prNumbers.length });
            try {
                const fetchResult = await fetchPrRefs(currentRepoFolderHandle, owner, repo, prNumbers);
                if (cancelled) return;
                setLocalPairwise({ phase: 'computing' });
                const pairwise = await computeBrowserPairwise(currentRepoFolderHandle, readyToCheck);
                if (cancelled) return;
                saveCachedPairwise(slug, key, pairwise);
                setLocalPairwise({ phase: 'ready', pairwise, failedFetches: fetchResult.failed.map((failure) => failure.number) });
            } catch (error) {
                if (!cancelled) setLocalPairwise({ phase: 'error', message: (error as Error).message });
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prs, owner, repo, promoted, currentRepoFolderHandle]);

    const pairwise: PairwisePrConflicts | null = localPairwise.phase === 'ready' ? localPairwise.pairwise : null;

    return { localPairwise, pairwise };
}
