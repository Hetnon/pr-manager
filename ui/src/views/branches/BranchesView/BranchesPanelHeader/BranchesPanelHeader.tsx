import { useContext, useEffect, useState } from 'react';
import { AnalysisContext } from '../../../AnalysisContext.js';
import styles from './BranchesPanelHeader.module.css';
import { formatDateTime } from '../../../../lib/formatDate.js';

export default function BranchesPanelHeader() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { busy, readProgress, fetching, conflictBusy, snapshot, lastFetch } = branchesAnalysis;
    const [loadingMessage, setLoadingMessage] = useState<string>('');

    useEffect(() => {
        if (fetching) {
            setLoadingMessage('Fetching origin…');
        } else if (conflictBusy) {
            setLoadingMessage('Analyzing conflicts…');
        } else if (busy) {
            setLoadingMessage(readProgress && readProgress.total > 0
                ? `Reading… ${readProgress.done}/${readProgress.total}`
                : 'Reading…');
        } else {
            setLoadingMessage('');
        }
    }, [fetching, conflictBusy, busy, readProgress]);
    
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
                    {!snapshot.currentBranch && <span>No Branch currently attached to the repo</span>}
                </div>
            )}
        </div>
    );
}


