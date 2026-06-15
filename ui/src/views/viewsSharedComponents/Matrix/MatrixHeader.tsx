import styles from '../Matrix.module.css';
import type { MatrixColumn } from './Matrix.types.js';
import { ColumnHeader } from './matrixCells.js';

interface Props {
    cornerLabel: string;
    metaLabels: string[];
    statusLabel: string;
    columns: MatrixColumn[];
}

// Column-major so the status header spans every meta row (replacing a table rowSpan).
export default function MatrixHeader({ cornerLabel, metaLabels, statusLabel, columns }: Readonly<Props>) {
    return (
        <div className={styles.headerBlock}>
            <div className={styles.labelColumn}>
                <div className={`${styles.rowLabel} ${styles.cornerLabel}`}>{cornerLabel}</div>
                {metaLabels.map((label) => (
                    <div key={label} className={`${styles.rowLabel} ${styles.metaLabel}`}>{label}</div>
                ))}
            </div>
            <div className={styles.statusHeader}>{statusLabel}</div>
            <div className={styles.columns}>
                {columns.map((column) => (
                    <ColumnHeader key={column.key} column={column} metaLabels={metaLabels} />
                ))}
            </div>
        </div>
    );
}
