import type { LocalPairwiseState } from '../types.js';
import styles from '../PrConflicts.module.css';

// Renders the current phase of the browser-side pairwise computation as a small
// status line (idle/ready render nothing, except a warning when some PR refs
// couldn't be fetched).
export default function LocalPairwiseStatus({ state }: { state: LocalPairwiseState }) {
    if (state.phase === 'idle' || state.phase === 'ready') {
        if (state.phase === 'ready' && state.failedFetches.length > 0) {
            return (
                <p className={`${styles.pairwiseStatus} ${styles.pairwiseWarn}`}>
                    ⚠ Couldn't fetch PR refs for: {state.failedFetches.map((prNumber) => `#${prNumber}`).join(', ')} —
                    pairwise will fall back to conservative warning for files those PRs touch.
                </p>
            );
        }
        return null;
    }
    if (state.phase === 'no-folder') {
        return (
            <p className={`${styles.pairwiseStatus} ${styles.pairwiseWarn}`}>
                Pick a local folder of this repo to enable real pairwise conflict detection.
            </p>
        );
    }
    if (state.phase === 'fetching') {
        return <p className={`${styles.pairwiseStatus} ${styles.pairwiseMuted}`}>Fetching {state.total} PR ref(s) via proxy…</p>;
    }
    if (state.phase === 'computing') {
        return <p className={`${styles.pairwiseStatus} ${styles.pairwiseMuted}`}>Running 3-way merge per shared file…</p>;
    }
    return <p className={`${styles.pairwiseStatus} ${styles.pairwiseFail}`}>Pairwise check failed: {state.message}</p>;
}
