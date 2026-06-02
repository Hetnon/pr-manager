import type { ReactNode } from 'react';
import styles from './Matrix.module.css';

export interface MatrixColumn {
    key: string | number;
    /** Top header cell content (e.g. a PR link or branch name). */
    header: ReactNode;
    /** Class applied to the header cell (e.g. safe/conflict tint). */
    headerClassName?: string;
    headerTitle?: string;
    /** One node per meta row; must line up with `metaLabels`. */
    meta: ReactNode[];
    /** Footer summary cell (e.g. ✓ / ✗). */
    footer: ReactNode;
    footerClassName?: string;
}

export interface MatrixBodyCell {
    content: ReactNode;
    className?: string;
    title?: string;
}

export interface MatrixFileRow {
    key: string;
    /** File-path label shown in the left column. */
    label: ReactNode;
    labelTitle?: string;
    /** Class applied to the file label cell (heat tint). */
    labelClassName?: string;
    /** Extra content rendered under the file label (e.g. a "master touched" chip). */
    extra?: ReactNode;
    /** Status cell between the file label and the entity cells. */
    status: ReactNode;
    statusClassName?: string;
    statusTitle?: string;
    /** One cell per column; must line up with `columns`. */
    cells: MatrixBodyCell[];
}

interface Props {
    /** Top-left label; aligns with the column header row. */
    cornerLabel: string;
    /** Left-column labels, top to bottom; each aligns with `column.meta`. */
    metaLabels: string[];
    /** Header for the status column (spans the whole header block). */
    statusLabel?: string;
    columns: MatrixColumn[];
    /** Footer toggle label, e.g. <strong>Good to merge? (12 files)</strong>. */
    footerLabel: ReactNode;
    files: MatrixFileRow[];
    expanded: boolean;
    onToggle: () => void;
}

/**
 * PR/branch overlap matrix rendered entirely from divs + flexbox (no <table>).
 * The header is laid out column-major so the status header spans every meta row
 * (replacing a table rowSpan); the footer and file rows are row-major. Columns
 * line up because every column has a fixed width and meta rows a fixed height —
 * see Matrix.module.css for the layout/gridline model.
 */
export default function Matrix({
    cornerLabel, metaLabels, statusLabel = 'Safe?', columns, footerLabel, files, expanded, onToggle,
}: Props) {
    return (
        <div className={styles.matrix}>
            <div className={styles.headerBlock}>
                <div className={styles.labelColumn}>
                    <div className={`${styles.rowLabel} ${styles.cornerLabel}`}>{cornerLabel}</div>
                    {metaLabels.map((label) => (
                        <div key={label} className={`${styles.rowLabel} ${styles.metaLabel}`}>{label}</div>
                    ))}
                </div>
                <div className={styles.statusHeader}>{statusLabel}</div>
                <div className={styles.columns}>
                    {columns.map((col) => (
                        <div key={col.key} className={styles.column}>
                            <div className={`${styles.colHeader} ${col.headerClassName ?? ''}`} title={col.headerTitle}>
                                {col.header}
                            </div>
                            {col.meta.map((node, i) => (
                                <div key={metaLabels[i] ?? i} className={styles.metaCell}>{node}</div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.footerRow}>
                <div className={`${styles.fileCell} ${styles.footerLabel}`}>
                    <button
                        className={styles.toggle}
                        onClick={onToggle}
                        aria-expanded={expanded}
                        title={expanded ? 'Hide file rows' : 'Show file rows'}
                    >
                        <span className={styles.triangle}>{expanded ? '▼' : '▶'}</span>
                        {footerLabel}
                    </button>
                </div>
                <div className={styles.statusCell} />
                {columns.map((col) => (
                    <div key={col.key} className={`${styles.footerCell} ${col.footerClassName ?? ''}`}>{col.footer}</div>
                ))}
            </div>

            {expanded && (
                <div className={styles.body}>
                    {files.map((row) => (
                        <div key={row.key} className={styles.fileRow}>
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
                    ))}
                </div>
            )}
        </div>
    );
}
