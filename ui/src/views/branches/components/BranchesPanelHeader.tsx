import type { LocalRepoSnapshot } from '../readLocalRepo.js';
import styles from '../BranchesView.module.css';

interface Props {
    busy: boolean;
    fetching: boolean;
    conflictBusy: boolean;
    snapshot: LocalRepoSnapshot | null;
}

// The panel's header row: the title, a transient "what's happening" word, and a
// one-line repo summary (default/current branch, branch count, read time).
export default function BranchesPanelHeader({ busy, fetching, conflictBusy, snapshot }: Props) {
    return (
        <div className={styles.panelHead}>
            <strong>Local branches</strong>
            {(busy || fetching || conflictBusy) && (
                <span className={styles.headBusy}>
                    {fetching ? 'Fetching origin…' : conflictBusy ? 'Analyzing conflicts…' : 'Reading…'}
                </span>
            )}
            {snapshot && (
                <span className={styles.headMeta}>
                    default <code>{snapshot.defaultBranch ?? '(none)'}</code> ·
                    current <code>{snapshot.currentBranch ?? '(detached)'}</code> ·
                    {snapshot.branches.length} branch{snapshot.branches.length === 1 ? '' : 'es'} ·
                    read in {snapshot.readMs}ms
                </span>
            )}
        </div>
    );
}
