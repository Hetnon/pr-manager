import { useContext } from 'react';
import { RepoContext } from '../../../repo/RepoContext.js';
import { AnalysisContext } from '../../AnalysisContext.js';
import DevActions from './DevActions.js';
import PrConflicts from './PrConflicts/PrConflicts.js';
import styles from './PrView.module.css';
import panel from '../../viewPanel.module.css';

// The "PR management" view: remote work a tech lead reviews and merges.
export default function PrView() {
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const { prs, prLoadStatus, contentError, loadPrs, prsAnalysis } = useContext(AnalysisContext);
    return (
        <section className={panel.panel}>
            {prLoadStatus && <p className={styles.prLoadStatus}>{prLoadStatus}</p>}
            {contentError && <p className="error">{contentError}</p>}
            {!contentError && currentRepoOwnerAndName && prs === null && <p className="loading">Loading PRs…</p>}
            {!contentError && currentRepoOwnerAndName && prs !== null && (
                <>
                    <DevActions matrix={prsAnalysis.matrix} />
                    <PrConflicts onMerged={loadPrs} />
                </>
            )}
        </section>
    );
}
