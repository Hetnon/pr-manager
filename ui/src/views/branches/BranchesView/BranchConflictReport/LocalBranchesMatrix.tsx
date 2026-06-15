import { useContext, useMemo, useState } from 'react';
import Matrix from '../../../viewsSharedComponents/Matrix/Matrix.js';
import MatrixLegend from '../../../viewsSharedComponents/MatrixLegend.js';
import styles from '../../../viewsSharedComponents/Matrix.module.css';
import { BranchReportContext } from './BranchReportContext.js';
import {
    LEGEND, META_LABELS,
    buildBranchMatrix, summarizeBranches, buildBranchColumns, buildBranchFileRows,
} from './branchMatrixModel.js';

export default function LocalBranchesMatrix() {
    const { effectiveReport, snapshot } = useContext(BranchReportContext);
    const { defaultBranch, branchChanges, branchGroups, fileDetail } = effectiveReport;
    const [expanded, setExpanded] = useState(true);
    const matrix = useMemo(() => buildBranchMatrix(branchChanges), [branchChanges]);

    if (matrix.columns.length === 0) {
        return <p className={styles.summary}>No branches with changes vs <code>{defaultBranch}</code>.</p>;
    }

    const stats = summarizeBranches(matrix, fileDetail);
    const columns = buildBranchColumns(matrix, snapshot.branches, branchGroups, stats.conflictBranches);
    const fileRows = buildBranchFileRows(matrix, fileDetail);

    const summary = (
        <div className={styles.summary}>
            <strong>{stats.safeCount}</strong> of <strong>{matrix.columns.length}</strong> branch(es) have no real conflicts.
            {' '}Conflicts: <strong>{stats.conflictFiles}</strong> file(s) · Review: {stats.warningFiles} · Identical: {stats.identicalFiles}
            {' · '}vs <code>{defaultBranch}</code>
        </div>
    );

    return (
        <Matrix
            cornerLabel="Branch"
            metaLabels={META_LABELS}
            columns={columns}
            footerLabel={<strong>Good to merge? ({matrix.files.length} files)</strong>}
            files={fileRows}
            expanded={expanded}
            onToggle={() => setExpanded((isExpanded) => !isExpanded)}
            summary={summary}
            legend={<MatrixLegend items={LEGEND} note="hover a row's status for details" />}
        />
    );
}
