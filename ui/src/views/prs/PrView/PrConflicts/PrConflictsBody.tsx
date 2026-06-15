import { useContext } from 'react';
import { PrConflictsContext } from './PrConflictsContext.js';
import PrMatrix from './PrMatrix/PrMatrix.js';
import ConflictingPrsPanel from './ConflictingPrsPanel.js';
import LocalPairwiseStatus from './LocalPairwiseStatus.js';
import PrDuplicatesBanner from './PrDuplicatesBanner.js';
import TechLeadActions from './TechLeadActions.js';
import styles from './PrConflicts.module.css';

// The PR conflict + merge panel layout. Every child reads PrConflictsContext, so this is
// pure composition + the inline status lines.
export default function PrConflictsBody() {
    const {
        readyToCheck, loading, error, lastClose, errors, allClean, nonGreens, readyToMerge,
    } = useContext(PrConflictsContext);

    return (
        <div className={styles.section}>
            <h2>Base Conflict Check</h2>
            <p className={styles.intro}>
                Files each candidate PR touches. <span className={styles.legendBad}>Red ✗</span> = real merge conflict with the base branch. <span className={styles.legendWarn}>Yellow ⚠</span> = the base branch also touched this file but it merges cleanly (review for semantic conflicts).
            </p>

            {loading && <p className={styles.status}>Checking {readyToCheck.length} candidate PR(s) against the base branch…</p>}
            {error && <p className="error-banner">{error}</p>}
            {lastClose && (
                <p className={`${styles.closeStatus} ${lastClose.ok ? styles.statusOk : styles.statusBad}`}>
                    {lastClose.ok ? '✓ ' : `✗ Couldn't close #${lastClose.prNumber}: `}{lastClose.message}
                </p>
            )}
            <LocalPairwiseStatus />
            <PrDuplicatesBanner />
            {errors.length > 0 && (
                <ul className={styles.errors}>
                    {errors.map(([prNumber, failure]) => (
                        <li key={prNumber}><strong>#{prNumber}</strong>: {failure.error}</li>
                    ))}
                </ul>
            )}
            {allClean && <p className={styles.clean}>✓ All candidate PRs are clean against the base branch.</p>}

            {nonGreens.length > 0 && <ConflictingPrsPanel />}
            {readyToCheck.length > 0 && <PrMatrix />}
            {readyToMerge.length > 0 && <TechLeadActions />}
        </div>
    );
}
