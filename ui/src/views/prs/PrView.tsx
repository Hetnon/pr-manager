import { useContext } from 'react';
import { RepoContext } from '../../repo/RepoContext.js';
import { AnalysisContext } from '../AnalysisContext.js';
import DevActions from './components/DevActions.js';
import PrConflicts from './PrConflicts.js';

// The "PR management" view: remote work a tech lead reviews and merges.
export default function PrView() {
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const { prs, prLoadStatus, contentError, loadPrs, prsAnalysis } = useContext(AnalysisContext);
    return (
        <>
            {prLoadStatus && <p className="pr-load-status">{prLoadStatus}</p>}
            {contentError && <p className="error">{contentError}</p>}
            {!contentError && currentRepoOwnerAndName && prs === null && <p className="loading">Loading PRs…</p>}
            {!contentError && currentRepoOwnerAndName && prs !== null && (
                <>
                    <DevActions matrix={prsAnalysis.matrix} />
                    <PrConflicts onMerged={loadPrs} />
                </>
            )}
        </>
    );
}
