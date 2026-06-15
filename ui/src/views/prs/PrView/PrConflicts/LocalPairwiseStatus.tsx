import { useContext } from 'react';
import { PrConflictsContext } from './PrConflictsContext.js';
import styles from './PrConflicts.module.css';

// Current phase of the browser-side pairwise computation as a small status line.
// idle/ready render nothing, except a warning when some PR refs couldn't be fetched.
export default function LocalPairwiseStatus() {
    const { localPairwise } = useContext(PrConflictsContext);
    if (localPairwise.phase === 'idle' || localPairwise.phase === 'ready') {
        if (localPairwise.phase === 'ready' && localPairwise.failedFetches.length > 0) {
            return (
                <p className={`${styles.pairwiseStatus} ${styles.pairwiseWarn}`}>
                    ⚠ Couldn't fetch PR refs for: {localPairwise.failedFetches.map((prNumber) => `#${prNumber}`).join(', ')} —
                    pairwise will fall back to conservative warning for files those PRs touch.
                </p>
            );
        }
        return null;
    }
    if (localPairwise.phase === 'no-folder') {
        return (
            <p className={`${styles.pairwiseStatus} ${styles.pairwiseWarn}`}>
                Pick a local folder of this repo to enable real pairwise conflict detection.
            </p>
        );
    }
    if (localPairwise.phase === 'fetching') {
        return <p className={`${styles.pairwiseStatus} ${styles.pairwiseMuted}`}>Fetching {localPairwise.total} PR ref(s) via proxy…</p>;
    }
    if (localPairwise.phase === 'computing') {
        return <p className={`${styles.pairwiseStatus} ${styles.pairwiseMuted}`}>Running 3-way merge per shared file…</p>;
    }
    return <p className={`${styles.pairwiseStatus} ${styles.pairwiseFail}`}>Pairwise check failed: {localPairwise.message}</p>;
}
