import { useContext } from 'react';
import { AnalysisContext } from '../../AnalysisContext.js';
import styles from './BranchesView.module.css';

// Repo-level status lines: read/analysis errors and the last origin-fetch result.
// (Per-action results live with their action — push/close in BranchList, dedup in
// DedupPanel, delete in DuplicatesBanner.)
export default function BranchesMessages() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { error, conflictError } = branchesAnalysis;
    return (
        <>
            {error && <p className={`${styles.message} bad`}>{error}</p>}
            {conflictError && <p className={`${styles.message} bad`}>{conflictError}</p>}
        </>
    );
}
