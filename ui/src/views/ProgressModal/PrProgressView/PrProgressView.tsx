import { useContext } from 'react';
import { AnalysisContext } from '../../AnalysisContext.js';
import styles from '../ProgressModal.module.css';

// Live progress of the PR conflict checks, shown in the shared top-level modal.
export default function PrProgressView() {
    const { prsAnalysis } = useContext(AnalysisContext);
    const { loading, readyToCheck, localPairwise } = prsAnalysis;
    return (
        <div className={styles.prProgress}>
            {loading && <p className={styles.prLineLead}>Checking {readyToCheck.length} candidate PR(s) against the base branch…</p>}
            {localPairwise.phase === 'fetching' && <p className={styles.prLine}>Fetching {localPairwise.total} PR ref(s) via proxy…</p>}
            {localPairwise.phase === 'computing' && <p className={styles.prLine}>Running 3-way merge per shared file…</p>}
        </div>
    );
}
