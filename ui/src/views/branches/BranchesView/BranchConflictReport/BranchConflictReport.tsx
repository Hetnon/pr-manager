import { useContext } from 'react';
import { AnalysisContext } from '../../../AnalysisContext.js';
import { BranchReportContext } from './BranchReportContext.js';
import { BranchReportProvider } from './BranchReportProvider.js';
import DedupPanel from './DedupPanel/DedupPanel.js';
import ConflictTriagePanel from './ConflictTriagePanel/ConflictTriagePanel.js';
import LocalBranchesMatrix from './LocalBranchesMatrix.js';
import DuplicatesBanner from './DuplicatesBanner/DuplicatesBanner.js';
import DefaultAssessmentPanel from './DefaultAssessmentPanel.js';
import styles from './BranchConflictReport.module.css';

// Gate: the report only exists once analysis has produced both a report and a snapshot.
export default function BranchConflictReport() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { conflictReport, snapshot } = branchesAnalysis;
    if (!conflictReport || !snapshot) return null;
    return (
        <BranchReportProvider conflictReport={conflictReport} snapshot={snapshot}>
            <BranchReportBody />
        </BranchReportProvider>
    );
}

function BranchReportBody() {
    const { rawReport } = useContext(BranchReportContext);
    return (
        <div className={styles.reportBlock}>
            <div className={styles.analyzeNote}>
                Analyzed in {rawReport.elapsedMs}ms · {rawReport.cacheHits} cache hits, {rawReport.cacheMisses} computed · real 3-way merge per shared file
            </div>
            <DuplicatesBanner />
            <DedupPanel />
            <LocalBranchesMatrix />
            <DefaultAssessmentPanel />
            <ConflictTriagePanel />
        </div>
    );
}
