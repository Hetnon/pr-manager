import type { PR } from '@shared/pr.js';
import type { PairwisePrConflicts, CheckConflictsResponse } from '@shared/conflicts.js';

// localStorage-backed, per-repo caches for the PR data layer, so a page reload
// shows the last-known PRs and analysis instantly instead of recomputing from
// scratch. All best-effort: any storage failure (quota, disabled) is swallowed.

function read<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

function write(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* quota exceeded / storage disabled — caching is best-effort */
    }
}

// Fingerprint of a PR set by number + head sha. Changes iff the PRs change, so
// it both detects "nothing new from the server" and keys the analysis caches.
export function prSetKey(prs: PR[]): string {
    return prs.map((pr) => `${pr.number}@${pr.headSha}`).sort().join(',');
}

// ---- the open-PR list ----
const prsStorageKey = (slug: string) => `pr-matrix.prs.${slug}`;
export const loadCachedPrs = (slug: string): PR[] | null => read<PR[]>(prsStorageKey(slug));
export const saveCachedPrs = (slug: string, prs: PR[]): void => write(prsStorageKey(slug), prs);

// ---- analysis results, each keyed by the candidate PR set ----
// Stored as a single { key, value } per repo: a stale key (the candidate PRs
// changed) simply misses and the analysis recomputes.
interface Keyed<T> { key: string; value: T; }

const pairwiseStorageKey = (slug: string) => `pr-matrix.pairwise.${slug}`;
export function loadCachedPairwise(slug: string, key: string): PairwisePrConflicts | null {
    const entry = read<Keyed<PairwisePrConflicts>>(pairwiseStorageKey(slug));
    return entry && entry.key === key ? entry.value : null;
}
export const saveCachedPairwise = (slug: string, key: string, value: PairwisePrConflicts): void =>
    write(pairwiseStorageKey(slug), { key, value });

const baseStorageKey = (slug: string) => `pr-matrix.base.${slug}`;
export function loadCachedBaseCheck(slug: string, key: string): CheckConflictsResponse | null {
    const entry = read<Keyed<CheckConflictsResponse>>(baseStorageKey(slug));
    return entry && entry.key === key ? entry.value : null;
}
export const saveCachedBaseCheck = (slug: string, key: string, value: CheckConflictsResponse): void =>
    write(baseStorageKey(slug), { key, value });
