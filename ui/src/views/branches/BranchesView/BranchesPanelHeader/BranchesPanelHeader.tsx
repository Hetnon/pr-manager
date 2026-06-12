import { useContext } from 'react';
import { AnalysisContext } from '../../../AnalysisContext.js';
import styles from './BranchesPanelHeader.module.css';

export default function BranchesPanelHeader() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { busy, fetching, conflictBusy, snapshot } = branchesAnalysis;
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
