import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { buildMatrix } from '../lib/matrix.js';
import PrMatrixSummary from './PrMatrixSummary.js';
import PrMatrixHeader from './PrMatrixHeader.js';
import PrMatrixBody, { type CellState } from './PrMatrixBody.js';
import styles from './PrMatrix.module.css';

interface Props {
    prs: PR[];
    cellState?: (pr: PR, filePath: string) => CellState;
    renderFileExtra?: (filePath: string) => ReactNode;
}

export default function PrMatrix({ prs, cellState, renderFileExtra }: Props) {
    const [expanded, setExpanded] = useState(true);
    const [fileColWidth, setFileColWidth] = useState<number | null>(null);
    const fileColRef = useRef<HTMLTableHeaderCellElement>(null);
    const matrix = useMemo(() => buildMatrix(prs), [prs]);

    // When expanded, capture the file column's actual width so the layout
    // doesn't reflow when the body collapses (header text is much shorter).
    useLayoutEffect(() => {
        if (expanded && fileColRef.current) {
            setFileColWidth(fileColRef.current.getBoundingClientRect().width);
        }
    }, [expanded, prs]);

    if (prs.length === 0) {
        return <p className="empty">No open PRs. 🎉</p>;
    }

    const { sortedPrs, files, prSafe, safeCount, hotFileCount } = matrix;

    return (
        <>
            <PrMatrixSummary safeCount={safeCount} totalPrs={prs.length} hotFileCount={hotFileCount} />
            <table className={styles.matrix}>
                <PrMatrixHeader
                    sortedPrs={sortedPrs}
                    fileCount={files.length}
                    prSafe={prSafe}
                    expanded={expanded}
                    onToggle={() => setExpanded((v) => !v)}
                    fileColRef={fileColRef}
                    fileColMinWidth={fileColWidth}
                />
                {expanded && <PrMatrixBody files={files} sortedPrs={sortedPrs} cellState={cellState} renderFileExtra={renderFileExtra} />}
            </table>
        </>
    );
}
