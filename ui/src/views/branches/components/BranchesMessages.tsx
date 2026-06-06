import type { FetchResult } from '../fetchOrigin.js';
import styles from '../BranchesView.module.css';

interface Props {
    error: string | null;
    conflictError: string | null;
    lastFetch: FetchResult | null;
}

// Repo-level status lines: read/analysis errors and the last origin-fetch result.
// (Per-action results live with their action — push/close in BranchList, dedup in
// DedupPanel, delete in DuplicatesBanner.)
export default function BranchesMessages({ error, conflictError, lastFetch }: Props) {
    return (
        <>
            {error && <p className={`${styles.message} ${styles.bad}`}>{error}</p>}
            {conflictError && <p className={`${styles.message} ${styles.bad}`}>{conflictError}</p>}
            {lastFetch && (
                <p className={`${styles.message} ${lastFetch.ok ? styles.ok : styles.bad}`}>
                    {lastFetch.ok
                        ? <>✓ Fetched at {new Date(lastFetch.fetchedAt).toLocaleTimeString()}{lastFetch.prunedRefs > 0 ? ` · pruned ${lastFetch.prunedRefs} stale ref(s)` : ''}</>
                        : <>✗ Fetch failed: {lastFetch.error}</>}
                </p>
            )}
        </>
    );
}
