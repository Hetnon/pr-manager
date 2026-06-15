import type { ReactNode } from 'react';
import styles from './Matrix.module.css';

export type LegendKind = 'dot' | 'safe' | 'identical' | 'clean' | 'conflict';

export interface LegendItem {
    kind?: LegendKind;
    label: ReactNode;
}

const SWATCH: Record<Exclude<LegendKind, 'dot'>, string> = {
    safe: styles.swatchSafe,
    identical: styles.swatchIdentical,
    clean: styles.swatchClean,
    conflict: styles.swatchConflict,
};

// Lives with Matrix so every consumer renders the same vocabulary in the same
// fixed spot above the grid — only the items differ per matrix.
export default function MatrixLegend({ items, note }: Readonly<{ items: LegendItem[]; note?: string }>) {
    return (
        <div className={styles.legend}>
            {items.map((item, index) => (
                <span key={index} className={styles.legendItem}>
                    {item.kind === 'dot'
                        ? <span className={styles.legendDot}>●</span>
                        : item.kind
                            ? <span className={`${styles.swatch} ${SWATCH[item.kind]}`} />
                            : null}
                    {item.label}
                </span>
            ))}
            {note && <span className={styles.italic}>{note}</span>}
        </div>
    );
}
