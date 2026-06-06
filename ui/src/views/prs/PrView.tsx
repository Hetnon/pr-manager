import { useContext } from 'react';
import { RepoContext } from '../../repo/RepoContext.js';
import { AnalysisContext } from '../../analysis/AnalysisContext.js';
import DevActions from './DevActions/DevActions.js';
import MasterCheck from './MasterCheck/MasterCheck.js';

// The "PR management" view: remote work a tech lead reviews and merges. The PR
// fetch + analysis come from the app-level data layer (AnalysisProvider); this
// shows the load status and composes the dev-actions and master-check panels.
export default function PrView() {
    const { repoOwnerAndName } = useContext(RepoContext);
    const { prs, prLoadStatus, contentError, reloadPrs, pr } = useContext(AnalysisContext);
    return (
        <>
            {prLoadStatus && <p className="pr-load-status">{prLoadStatus}</p>}
            {contentError && <p className="error">{contentError}</p>}
            {!contentError && repoOwnerAndName && prs === null && <p className="loading">Loading PRs…</p>}
            {!contentError && repoOwnerAndName && prs !== null && (
                <>
                    <DevActions matrix={pr.matrix} />
                    <MasterCheck onMerged={reloadPrs} />
                </>
            )}
        </>
    );
}
