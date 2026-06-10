import { useContext } from 'react';
import Modal from '../../components/Modal.js';
import { useDelayedFlag } from './useDelayedFlag.js';
import { AnalysisContext } from '../AnalysisContext.js';
import BranchesProgressView from './BranchesProgressView/BranchesProgressView.js';
import PrProgressView from './PrProgressView/PrProgressView.js';
import styles from './ProgressModal.module.css';

// One modal showing live progress of whichever repo checks are running — branch analysis and/or the PR conflict check, in parallel.
export default function ProgressModal() {
    const { branchesAnalysis, prsAnalysis } = useContext(AnalysisContext);

    // Branch side self-debounces (progressModalOpen has a 300ms delay); debounce the
    // PR side the same way so a fast cached check doesn't flash.
    const branchVisible = branchesAnalysis.progressModalOpen;
    const prActive = prsAnalysis.loading || prsAnalysis.localPairwise.phase === 'fetching' || prsAnalysis.localPairwise.phase === 'computing';
    const prVisible = useDelayedFlag(prActive, 300);

    return (
        <Modal open={branchVisible || prVisible} onClose={() => { /* auto-closes when the checks finish */ }} maxWidth="sm" disableBackdropClose>
            {branchVisible && (
                <section>
                    <h3 className={styles.heading}>Analyzing local branches</h3>
                    <BranchesProgressView />
                </section>
            )}
            {prVisible && (
                <section className={branchVisible ? styles.sectionGap : undefined}>
                    <h3 className={styles.heading}>Checking PRs against the base branch</h3>
                    <PrProgressView />
                </section>
            )}
        </Modal>
    );
}
