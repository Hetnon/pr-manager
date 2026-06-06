import { useEffect, useMemo, useState } from 'react';
import type { PR } from '@shared/pr.js';
import type { CheckConflictsResponse, MasterTouch } from '@shared/conflicts.js';
import { checkMasterConflicts as apiCheckConflicts } from '../../../../api/prs.js';

// Runs the server-side "does each candidate PR conflict with master?" check
// whenever the candidate set changes, and shapes the response into fast lookups:
//   - lookups: per-PR sets of conflicting / master-touched files
//   - masterTouchByFile: who last touched each file on master
export function useMasterConflicts(owner: string, repo: string, prs: PR[], readyToCheck: PR[], promoted: Set<number>) {
    const [response, setResponse] = useState<CheckConflictsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (readyToCheck.length === 0) {
            setResponse(null);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            setResponse(null);
            try {
                const conflictResponse = await apiCheckConflicts(owner, repo, readyToCheck.map((pr) => pr.number));
                if (!cancelled) setResponse(conflictResponse);
            } catch (error) {
                if (!cancelled) setError((error as Error).message);
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
