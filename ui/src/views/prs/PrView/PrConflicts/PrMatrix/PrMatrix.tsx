import { useContext, useState } from 'react';
import Matrix from '../../../../viewsSharedComponents/Matrix/Matrix.js';
import MatrixLegend from '../../../../viewsSharedComponents/MatrixLegend.js';
import { PrConflictsContext } from '../PrConflictsContext.js';
import PrMatrixSummary from './PrMatrixSummary.js';
import { LEGEND, META_LABELS, buildPrColumns, buildPrFileRows } from './prMatrixModel.js';
import localStyles from './PrMatrix.module.css';

export default function PrMatrix() {
    const { readyMatrix, cellState, renderFileExtra } = useContext(PrConflictsContext);
    const [expanded, setExpanded] = useState(true);
    const { sortedPrs, files, safeCount, hotFileCount } = readyMatrix;

    if (sortedPrs.length === 0) {
        return <p className={localStyles.empty}>No open PRs. 🎉</p>;
    }

    return (
        <Matrix
            cornerLabel="PR #"
            metaLabels={META_LABELS}
            columns={buildPrColumns(readyMatrix)}
            footerLabel={<strong>Good to Merge? ({files.length} files)</strong>}
            files={buildPrFileRows(readyMatrix, cellState, renderFileExtra)}
            expanded={expanded}
            onToggle={() => setExpanded((isExpanded) => !isExpanded)}
            summary={<PrMatrixSummary safeCount={safeCount} totalPrs={sortedPrs.length} hotFileCount={hotFileCount} />}
            legend={<MatrixLegend items={LEGEND} note="hover a cell for details" />}
        />
    );
}
