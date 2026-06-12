import { useContext, useEffect, useState } from 'react';
import { AnalysisContext } from '../../../AnalysisContext.js';
import styles from './BranchesPanelHeader.module.css';
import { formatDateTime } from '../../../../lib/formatDate.js';

export default function BranchesPanelHeader() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { busy, fetching, conflictBusy, snapshot, lastFetch } = branchesAnalysis;
    const [loadingMessage, setLoadingMessage] = useState<string>('');

    useEffect(() => {
        if (fetching) {
            setLoadingMessage('Fetching origin…');
        } else if (conflictBusy) {
            setLoadingMessage('Analyzing conflicts…');
        } else if (busy) {
            setLoadingMessage('Reading…');
        } else {
            setLoadingMessage('');
        }
    }, [fetching, conflictBusy, busy]);
    
    return (
        <div className={styles.panelHead}>
            <strong title={snapshot ? `Read in ${snapshot.readMs}ms` : undefined}>Local branches</strong>
            <span className={styles.headBusy}>
                {loadingMessage}
                {lastFetch && (
                    <span className={`${styles.message} ${lastFetch.ok ? 'ok' : 'bad'}`}>
                        {lastFetch.ok
                            ? <>✓ Fetched at {formatDateTime(lastFetch.fetchedAt)}{lastFetch.prunedRefs > 0 ? ` · pruned ${lastFetch.prunedRefs} stale ref(s)` : ''}</>
                            : <>✗ Fetch failed: {lastFetch.error}</>}
                    </span>
                )}
            </span>
            
            {snapshot && (
                <div className={styles.headMeta}>
                    <span>Default branch: {snapshot.defaultBranch ?? '(none)'}</span>
                    <span>Current branch: {snapshot.currentBranch ?? '(detached)'}</span>
                    <span>Total: {snapshot.branches.length} branch{snapshot.branches.length === 1 ? '' : 'es'}</span>
                </div>
            )}
        </div>
    );
}


