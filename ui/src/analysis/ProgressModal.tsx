import { useContext } from 'react';
import Modal from '../components/Modal.js';
import { useDelayedFlag } from '../hooks/useDelayedFlag.js';
import { AnalysisContext } from './AnalysisContext.js';
import ConflictProgressView from '../views/branches/components/ConflictProgressView.js';
import PrProgressView from '../views/prs/MasterCheck/components/PrProgressView.js';

// One modal showing the live progress of whichever repo checks are running —
// branch analysis and/or the PR conflict check, in parallel. Reads the analysis
// directly and is rendered explicitly (not emitted from a context provider).
export default function ProgressModal() {
    const { branch, pr } = useContext(AnalysisContext);

    // The branch side debounces itself (progressModalOpen has a 300ms delay);
    // debounce the PR side the same way so a fast cached check doesn't flash.
    const branchVisible = branch.progressModalOpen;
    const prActive = pr.loading || pr.localPairwise.phase === 'fetching' || pr.localPairwise.phase === 'computing';
    const prVisible = useDelayedFlag(prActive, 300);

    return (
        <Modal open={branchVisible || prVisible} onClose={() => { /* auto-closes when the checks finish */ }} maxWidth="sm" disableBackdropClose>
            {branchVisible && (
                <section>
                    <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Analyzing local branches</h3>
                    <ConflictProgressView progress={branch.conflictProgress} processedFiles={branch.processedFiles} defaultBranchName={branch.snapshot?.defaultBranch ?? 'default'} />
                </section>
            )}
            {prVisible && (
                <section style={{ marginTop: branchVisible ? 16 : 0 }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Checking PRs against master</h3>
                    <PrProgressView loading={pr.loading} candidateCount={pr.readyToCheck.length} localPairwise={pr.localPairwise} />
                </section>
            )}
        </Modal>
    );
}
