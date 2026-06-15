import type { ReactNode } from 'react';
import styles from '../Matrix.module.css';
import type { MatrixColumn } from './Matrix.types.js';

interface Props {
    footerLabel: ReactNode;
    columns: MatrixColumn[];
    expanded: boolean;
    onToggle: () => void;
}

export default function MatrixFooterRow({ footerLabel, columns, expanded, onToggle }: Readonly<Props>) {
    return (
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
            {columns.map((column) => (
                <div key={column.key} className={`${styles.footerCell} ${column.footerClassName ?? ''}`}>{column.footer}</div>
            ))}
        </div>
    );
}
