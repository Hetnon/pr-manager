import type { ReactNode } from 'react';
import styles from '../Matrix.module.css';
import type { MatrixColumn, MatrixFileRow } from './Matrix.types.js';
import MatrixHeader from './MatrixHeader.js';
import MatrixFooterRow from './MatrixFooterRow.js';
import MatrixBody from './MatrixBody.js';

export type { MatrixColumn, MatrixBodyCell, MatrixFileRow } from './Matrix.types.js';

interface Props {
    cornerLabel: string;
    metaLabels: string[]; // each aligns with column.meta, top to bottom
    statusLabel?: string;
    columns: MatrixColumn[];
    footerLabel: ReactNode;
    files: MatrixFileRow[];
    expanded: boolean;
    onToggle: () => void;
    summary?: ReactNode;
    legend?: ReactNode;
}

// PR/branch overlap matrix built entirely from divs + flexbox (no <table>); see
// Matrix.module.css for the fixed-width column / gridline model.
export default function Matrix({
    cornerLabel, metaLabels, statusLabel = 'Safe?', columns, footerLabel, files, expanded, onToggle, summary, legend,
}: Readonly<Props>) {
    return (
        <>
            {summary}
            {legend}
            <div className={styles.matrix}>
                <MatrixHeader cornerLabel={cornerLabel} metaLabels={metaLabels} statusLabel={statusLabel} columns={columns} />
                <MatrixFooterRow footerLabel={footerLabel} columns={columns} expanded={expanded} onToggle={onToggle} />
                {expanded && <MatrixBody files={files} columns={columns} />}
            </div>
        </>
    );
}
