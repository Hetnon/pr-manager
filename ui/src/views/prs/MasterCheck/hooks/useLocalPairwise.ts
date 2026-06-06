import { useEffect, useState } from 'react';
import type { PR } from '@shared/pr.js';
import type { PairwisePrConflicts } from '@shared/conflicts.js';
import { queryFolderPermission } from '../../../../repo/folderPermission.js';
import { fetchPrRefs } from '../fetchPrRefs.js';
import { computeBrowserPairwise } from '../computeBrowserPairwise.js';
import type { LocalPairwiseState } from '../types.js';

// Browser-side pairwise conflict detection between the candidate PRs. Fetches
// refs/pull/<N>/head for each, then runs a 3-way merge per shared file. Needs
// read+write folder access (fetch writes pack files); can only *query* the
// permission from an effect — the user grants it via the header badge.
export function useLocalPairwise(
    owner: string,
    repo: string,
    prs: PR[],
    readyToCheck: PR[],
    promoted: Set<number>,
    folderHandle: FileSystemDirectoryHandle | null,
) {
    const [localPairwise, setLocalPairwise] = useState<LocalPairwiseState>({ phase: 'idle' });

    useEffect(() => {
        if (readyToCheck.length === 0) { setLocalPairwise({ phase: 'idle' }); return; }
        if (!folderHandle) { setLocalPairwise({ phase: 'no-folder' }); return; }
        let cancelled = false;
        (async () => {
            const level = await queryFolderPermission(folderHandle);
            if (cancelled) return;
            if (level !== 'readwrite') { setLocalPairwise({ phase: 'needs-readwrite' }); return; }
            const prNumbers = readyToCheck.map((pr) => pr.number);
            setLocalPairwise({ phase: 'fetching', total: prNumbers.length });
            try {
                const fetchResult = await fetchPrRefs(folderHandle, owner, repo, prNumbers);
                if (cancelled) return;
                setLocalPairwise({ phase: 'computing' });
                const pairwise = await computeBrowserPairwise(folderHandle, readyToCheck);
                if (cancelled) return;
                setLocalPairwise({ phase: 'ready', pairwise, failedFetches: fetchResult.failed.map((failure) => failure.number) });
            } catch (error) {
                if (!cancelled) setLocalPairwise({ phase: 'error', message: (error as Error).message });
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prs, owner, repo, promoted, folderHandle]);

    const pairwise: PairwisePrConflicts | null = localPairwise.phase === 'ready' ? localPairwise.pairwise : null;

    return { localPairwise, pairwise };
}
