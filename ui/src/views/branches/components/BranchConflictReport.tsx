import type { LocalConflictReport } from '../checkLocalConflicts.js';
import type { LocalRepoSnapshot } from '../readLocalRepo.js';
import DedupPanel from '../DedupPanel.js';
import LocalBranchesMatrix from '../LocalBranchesMatrix.js';
import DuplicatesBanner from './DuplicatesBanner.js';
import MatrixLegend from './MatrixLegend.js';
import MasterAssessmentPanel from './MasterAssessmentPanel.js';
import styles from '../BranchesView.module.css';

interface Props {
    conflictReport: LocalConflictReport;
    snapshot: LocalRepoSnapshot;
    setConflictReport: React.Dispatch<React.SetStateAction<LocalConflictReport | null>>;
    refresh: (currentRepoFolderHandle: FileSystemDirectoryHandle) => Promise<void>;
}

// The 3-way-merge conflict report: the duplicate/dedup actions, the legend, the
// branch×file matrix, and the vs-default assessment. Each child owns its own
// action; this just composes them under the analysis summary line.
export default function BranchConflictReport({ conflictReport, snapshot, setConflictReport, refresh }: Props) {
    return (
        <div className={styles.reportBlock}>
            <div className={styles.analyzeNote}>
                Analyzed in {conflictReport.elapsedMs}ms · {conflictReport.cacheHits} cache hits, {conflictReport.cacheMisses} computed · real 3-way merge per shared file
            </div>
            <DuplicatesBanner groups={conflictReport.branchGroups} refresh={refresh} />
            <DedupPanel conflictReport={conflictReport} setConflictReport={setConflictReport} />
            <MatrixLegend />
            <LocalBranchesMatrix
                defaultBranch={conflictReport.defaultBranch}
                branches={snapshot.branches}
                branchChanges={conflictReport.branchChanges}
                branchGroups={conflictReport.branchGroups}
                fileDetail={conflictReport.fileDetail}
            />
            <MasterAssessmentPanel
                defaultBranch={conflictReport.defaultBranch}
                branchVsDefault={conflictReport.branchVsDefault}
            />
        </div>
    );
}
