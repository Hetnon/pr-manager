import styles from '../Matrix.module.css';
import type { MatrixColumn, MatrixFileRow } from './Matrix.types.js';

// One column's header cell plus its meta boxes, laid out column-major.
export function ColumnHeader({ column, metaLabels }: Readonly<{ column: MatrixColumn; metaLabels: string[] }>) {
    return (
        <div className={styles.column}>
            <div className={`${styles.colHeader} ${column.headerClassName ?? ''}`} title={column.headerTitle}>
                {column.header}
            </div>
            {column.meta.map((node, i) => (
                <div key={metaLabels[i] ?? i} className={styles.metaBox}>{node}</div>
            ))}
        </div>
    );
}

// One file's row: label cell, status cell, then one body cell per column.
export function FileRow({ row, columns }: Readonly<{ row: MatrixFileRow; columns: MatrixColumn[] }>) {
    return (
        <div className={styles.fileRow}>
            <div className={`${styles.fileCell} ${row.labelClassName ?? ''}`} title={row.labelTitle}>
                <div className={styles.filePath}>{row.label}</div>
                {row.extra}
            </div>
            <div className={`${styles.statusCell} ${row.statusClassName ?? ''}`} title={row.statusTitle}>{row.status}</div>
            {row.cells.map((cell, i) => (
                <div
                    key={columns[i]?.key ?? i}
                    className={`${styles.bodyCell} ${cell.className ?? ''}`}
                    title={cell.title}
                >
                    {cell.content}
                </div>
            ))}
        </div>
    );
}
