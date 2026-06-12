import { useMemo, useState } from 'react';
import Matrix from '../../../components/Matrix.js';
import MatrixLegend from '../../../components/MatrixLegend.js';
import styles from '../../../components/Matrix.module.css';
import type { LocalBranch } from '../../readLocalRepo.js';
import type { BranchChanges, BranchGroup } from '../../checkLocalConflicts.js';
import type { FileConflictDetail } from '../../lineLevelConflicts.js';
import {
    LEGEND, META_LABELS,
    buildBranchMatrix, summarizeBranches, buildBranchColumns, buildBranchFileRows,
} from './branchMatrixModel.js';

interface Props {
    defaultBranch: string;
    branches: LocalBranch[];
    branchChanges: BranchChanges[];
    // Groups of branches sharing a HEAD sha; each maps to one column via canonical.
    branchGroups?: BranchGroup[];
    // Per-file 3-way-merge detail; absent → presence-only coloring.
    fileDetail?: Record<string, FileConflictDetail>;
}

export default function LocalBranchesMatrix({ defaultBranch, branches, branchChanges, branchGroups, fileDetail }: Readonly<Props>) {
    const [expanded, setExpanded] = useState(true);
    const matrix = useMemo(() => buildBranchMatrix(branchChanges), [branchChanges]);

    if (matrix.columns.length === 0) {
        return <p className={styles.summary}>No branches with changes vs <code>{defaultBranch}</code>.</p>;
    }

    const stats = summarizeBranches(matrix, fileDetail);
    const columns = buildBranchColumns(matrix, branches, branchGroups, stats.conflictBranches);
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
