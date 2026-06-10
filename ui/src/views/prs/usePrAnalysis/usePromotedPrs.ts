import { useCallback, useEffect, useState } from 'react';
import type { PR } from '@shared/pr.js';

// Tracks which conflicting PRs the user has manually promoted into the merge
// check. Local to the session; automatically drops members that disappear from
// the PR set (e.g. after a merge + refresh).
export function usePromotedPrs(sortedPrs: PR[]) {
    const [promoted, setPromoted] = useState<Set<number>>(new Set());

    useEffect(() => {
        setPromoted((current) => {
            const filtered = new Set([...current].filter((prNumber) => sortedPrs.some((pr) => pr.number === prNumber)));
            return filtered.size === current.size ? current : filtered;
        });
    }, [sortedPrs]);

    const togglePromoted = useCallback((prNumber: number, on: boolean) => {
        setPromoted((current) => {
            const next = new Set(current);
            if (on) next.add(prNumber); else next.delete(prNumber);
            return next;
        });
    }, []);

    return { promoted, togglePromoted };
}
