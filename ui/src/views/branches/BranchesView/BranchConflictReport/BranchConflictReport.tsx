import { useContext, useMemo } from 'react';
import type { LocalConflictReport } from '../../checkLocalConflicts.js';
import type { LocalRepoSnapshot } from '../../readLocalRepo.js';
import { AnalysisContext } from '../../../AnalysisContext.js';
import DedupPanel from './DedupPanel/DedupPanel.js';
import { useDedupChoices } from './DedupPanel/useDedupChoices.js';
import { triageStatically } from '../../triage/conflictTriage.js';
import ConflictTriagePanel from '../../triage/ConflictTriagePanel.js';
import LocalBranchesMatrix from './LocalBranchesMatrix.js';
import DuplicatesBanner from './DuplicatesBanner.js';
import MatrixLegend from './MatrixLegend.js';
import DefaultAssessmentPanel from './DefaultAssessmentPanel.js';
import styles from '../BranchesView.module.css';

// Gate: the conflict report only exists once analysis has run (and needs a snapshot).
// useDedupChoices dereferences the report, so the hook-using body is a separate
// component that only mounts with both in hand.
export default function BranchConflictReport() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { conflictReport, snapshot, refresh } = branchesAnalysis;
    if (!conflictReport || !snapshot) return null;
    return <ConflictReport conflictReport={conflictReport} snapshot={snapshot} refresh={refresh} />;
}

interface Props {
    conflictReport: LocalConflictReport;
    snapshot: LocalRepoSnapshot;
    refresh: (currentRepoFolderHandle: FileSystemDirectoryHandle) => Promise<void>;
}

// The 3-way-merge conflict report: the dedup collapse control, the legend, the
// branch×file matrix, and the vs-default assessment. The matrix renders the effective
// report (raw analysis with the collapsed identical files filtered out as a view).
function ConflictReport({ conflictReport, snapshot, refresh }: Readonly<Props>) {
    const { groups, keeperFor, isIncluded, toggleIncluded, setKeeper, effectiveReport } = useDedupChoices(conflictReport);
    // Triage runs on the effective (post-dedup) report, so the dedup decisions gate it.
    const triage = useMemo(() => triageStatically(effectiveReport), [effectiveReport]);
    return (
        <div className={styles.reportBlock}>
            <div className={styles.analyzeNote}>
                Analyzed in {conflictReport.elapsedMs}ms · {conflictReport.cacheHits} cache hits, {conflictReport.cacheMisses} computed · real 3-way merge per shared file
            </div>
            <DuplicatesBanner groups={conflictReport.branchGroups} refresh={refresh} />
            <DedupPanel
                groups={groups}
                keeperFor={keeperFor}
                isIncluded={isIncluded}
                toggleIncluded={toggleIncluded}
                setKeeper={setKeeper}
            />
            <MatrixLegend />
            <LocalBranchesMatrix
                defaultBranch={effectiveReport.defaultBranch}
                branches={snapshot.branches}
                branchChanges={effectiveReport.branchChanges}
                branchGroups={effectiveReport.branchGroups}
                fileDetail={effectiveReport.fileDetail}
            />
            <DefaultAssessmentPanel
                defaultBranch={effectiveReport.defaultBranch}
                branchVsDefault={effectiveReport.branchVsDefault}
            />
            <ConflictTriagePanel results={triage} />
        </div>
    );
}
