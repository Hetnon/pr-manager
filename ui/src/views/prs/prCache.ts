import type { PR } from '@shared/pr.js';
import type { PairwisePrConflicts, CheckConflictsResponse } from '@shared/conflicts.js';
import { loadJson, saveJson } from '../../lib/localStorage.js';

// localStorage-backed, per-repo caches for the PR data layer, so a page reload
// shows the last-known PRs and analysis instantly instead of recomputing from
// scratch.

// Fingerprint of a PR set by number + head sha. Changes iff the PRs change, so
// it both detects "nothing new from the server" and keys the analysis caches.
export function prSetKey(prs: PR[]): string {
    return prs.map((pr) => `${pr.number}@${pr.headSha}`).sort().join(',');
}

// ---- the open-PR list ----
const prsStorageKey = (slug: string) => `pr-matrix.prs.${slug}`;
export const loadCachedPrs = (slug: string): PR[] | null => loadJson<PR[]>(prsStorageKey(slug));
export const saveCachedPrs = (slug: string, prs: PR[]): void => saveJson(prsStorageKey(slug), prs);

// ---- analysis results, each keyed by the candidate PR set ----
// Stored as a single { key, value } per repo: a stale key (the candidate PRs
// changed) simply misses and the analysis recomputes.
interface Keyed<T> { key: string; value: T; }

const pairwiseStorageKey = (slug: string) => `pr-matrix.pairwise.${slug}`;
export function loadCachedPairwise(slug: string, key: string): PairwisePrConflicts | null {
    const entry = loadJson<Keyed<PairwisePrConflicts>>(pairwiseStorageKey(slug));
    return entry?.key === key ? entry.value : null;
}
export const saveCachedPairwise = (slug: string, key: string, value: PairwisePrConflicts): void =>
    saveJson(pairwiseStorageKey(slug), { key, value });

const baseStorageKey = (slug: string) => `pr-matrix.base.${slug}`;
export function loadCachedBaseCheck(slug: string, key: string): CheckConflictsResponse | null {
    const entry = loadJson<Keyed<CheckConflictsResponse>>(baseStorageKey(slug));
    return entry?.key === key ? entry.value : null;
}
export const saveCachedBaseCheck = (slug: string, key: string, value: CheckConflictsResponse): void =>
    saveJson(baseStorageKey(slug), { key, value });
