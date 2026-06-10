import { useContext, useEffect, useMemo, useState } from 'react';
import type { PR } from '@shared/pr.js';
import type { CheckConflictsResponse, BaseTouch } from '@shared/conflicts.js';
import { RepoContext } from '../../../repo/RepoContext.js';
import * as prApi from '../../../api/prs.js';
import { loadCachedBaseCheck, saveCachedBaseCheck, prSetKey } from '../../../analysis/prCache.js';

// Runs the server-side "does each candidate PR conflict with the base branch?" check
// whenever the candidate set changes, shaping the response into fast lookups:
// per-PR sets of conflicting / base-touched files, and who last touched each file on base.
export function useBaseConflicts(prs: PR[], readyToCheck: PR[], promoted: Set<number>) {
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
        // Stale-while-revalidate: the base branch can move under us, so we show the
        // cached verdict instantly and re-check in the background.
        const slug = `${owner}/${repo}`;
        const key = prSetKey(readyToCheck);
        const cached = loadCachedBaseCheck(slug, key);
        if (cached) setResponse(cached);

        let cancelled = false;
        (async () => {
            setLoading(!cached);
            setError(null);
            if (!cached) setResponse(null);
            try {
                const conflictResponse = await prApi.checkBaseConflicts(owner, repo, readyToCheck.map((pr) => pr.number));
                if (cancelled) return;
                setResponse(conflictResponse);
                saveCachedBaseCheck(slug, key, conflictResponse);
            } catch (error) {
                // On a background revalidation failure keep the cached result visible.
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
                touched: new Set(result.ok ? result.touchedByBase : []),
            });
        }
        return byPr;
    }, [results]);

    const baseTouchByFile = useMemo(() => {
        if (!results) return null;
        const byFile = new Map<string, BaseTouch>();
        for (const result of Object.values(results)) {
            if (!result.ok) continue;
            for (const [path, info] of Object.entries(result.baseLastTouched)) {
                byFile.set(path, info);
            }
        }
        return byFile;
    }, [results]);

    return { results, loading, error, lookups, baseTouchByFile };
}
