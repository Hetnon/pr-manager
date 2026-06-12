import { useContext } from 'react';
import { AnalysisContext } from '../../AnalysisContext.js';
import styles from './BranchesView.module.css';
import { formatDateTime } from '../../../lib/formatDate.js';

// Repo-level status lines: read/analysis errors and the last origin-fetch result.
// (Per-action results live with their action — push/close in BranchList, dedup in
// DedupPanel, delete in DuplicatesBanner.)
export default function BranchesMessages() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { error, conflictError, lastFetch } = branchesAnalysis;
    return (
        <>
            {error && <p className={`${styles.message} ${styles.bad}`}>{error}</p>}
            {conflictError && <p className={`${styles.message} ${styles.bad}`}>{conflictError}</p>}
            {lastFetch && (
                <p className={`${styles.message} ${lastFetch.ok ? styles.ok : styles.bad}`}>
                    {lastFetch.ok
                        ? <>✓ Fetched at {formatDateTime(lastFetch.fetchedAt)}{lastFetch.prunedRefs > 0 ? ` · pruned ${lastFetch.prunedRefs} stale ref(s)` : ''}</>
                        : <>✗ Fetch failed: {lastFetch.error}</>}
                </p>
            )}
        </>
    );
}
