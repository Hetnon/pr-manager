import { useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import type { SharedFileMatrix } from '../../../sharedFiles.js';
import Matrix from '../../../../components/Matrix.js';
import MatrixLegend from '../../../../components/MatrixLegend.js';
import PrMatrixSummary from './PrMatrixSummary.js';
import { LEGEND, META_LABELS, buildPrColumns, buildPrFileRows, type CellState } from './prMatrixModel.js';
import localStyles from './PrMatrix.module.css';

export type { CellState } from './prMatrixModel.js';

interface Props {
    matrix: SharedFileMatrix;
    cellState?: (pr: PR, filePath: string) => CellState;
    renderFileExtra?: (filePath: string) => ReactNode;
}

// Purely presentational: renders the matrix it's given. The caller owns the input
// PR set and builds the matrix (PrConflicts builds it from readyToCheck).
export default function PrMatrix({ matrix, cellState, renderFileExtra }: Readonly<Props>) {
    const [expanded, setExpanded] = useState(true);
    const { sortedPrs, files, safeCount, hotFileCount } = matrix;

    if (sortedPrs.length === 0) {
        return <p className={localStyles.empty}>No open PRs. 🎉</p>;
    }

    return (
        <Matrix
            cornerLabel="PR #"
            metaLabels={META_LABELS}
            columns={buildPrColumns(matrix)}
            footerLabel={<strong>Good to Merge? ({files.length} files)</strong>}
            files={buildPrFileRows(matrix, cellState, renderFileExtra)}
            expanded={expanded}
            onToggle={() => setExpanded((isExpanded) => !isExpanded)}
            summary={<PrMatrixSummary safeCount={safeCount} totalPrs={sortedPrs.length} hotFileCount={hotFileCount} />}
            legend={<MatrixLegend items={LEGEND} note="hover a cell for details" />}
        />
    );
}
