import { useContext, useEffect, useMemo, useState } from 'react';
import type { PR } from '@shared/pr.js';
import type { CheckConflictsResponse, MasterTouch } from '@shared/conflicts.js';
import { RepoContext } from '../../../../repo/RepoContext.js';
import * as prApi from '../../../../api/prs.js';
import { loadCachedMasterCheck, saveCachedMasterCheck, prSetKey } from '../../../../analysis/prCache.js';

// Runs the server-side "does each candidate PR conflict with master?" check
// whenever the candidate set changes, and shapes the response into fast lookups:
//   - lookups: per-PR sets of conflicting / master-touched files
//   - masterTouchByFile: who last touched each file on master
export function useMasterConflicts(prs: PR[], readyToCheck: PR[], promoted: Set<number>) {
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const [response, setResponse] = useState<CheckConflictsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (readyToCheck.length === 0 || !owner || !repo) {
            setResponse(null);
            return;
        }
        // Stale-while-revalidate: master can move under us, so we can't trust a
        // cached verdict outright — but we can show it instantly and re-check in
        // the background. A page reload thus renders the last result with no
        // spinner, then quietly refreshes it.
        const slug = `${owner}/${repo}`;
        const key = prSetKey(readyToCheck);
        const cached = loadCachedMasterCheck(slug, key);
        if (cached) setResponse(cached);

        let cancelled = false;
        (async () => {
            setLoading(!cached);
            setError(null);
            if (!cached) setResponse(null);
            try {
                const conflictResponse = await prApi.checkMasterConflicts(owner, repo, readyToCheck.map((pr) => pr.number));
                if (cancelled) return;
                setResponse(conflictResponse);
                saveCachedMasterCheck(slug, key, conflictResponse);
            } catch (error) {
                // On a background revalidation failure keep the cached result visible
                // rather than replacing it with an error.
                if (!cancelled && !cached) setError((error as Error).message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prs, owner, repo, promoted]);

    const results = response?.results ?? null;

    const lookups = useMemo(() => {
        if (!results) return null;
        const byPr = new Map<number, { conflicts: Set<string>; touched: Set<string> }>();
        for (const [prNumber, result] of Object.entries(results)) {
            byPr.set(Number(prNumber), {
                conflicts: new Set(result.ok ? result.conflicts : []),
                touched: new Set(result.ok ? result.touchedByMaster : []),
            });
        }
        return byPr;
    }, [results]);

    const masterTouchByFile = useMemo(() => {
        if (!results) return null;
        const byFile = new Map<string, MasterTouch>();
        for (const result of Object.values(results)) {
            if (!result.ok) continue;
            for (const [path, info] of Object.entries(result.masterLastTouched)) {
                byFile.set(path, info);
            }
        }
        return byFile;
    }, [results]);

    return { results, loading, error, lookups, masterTouchByFile };
}
