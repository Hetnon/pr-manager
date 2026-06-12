import type { ReactNode } from 'react';
import styles from './Matrix.module.css';

export type MetaVariant = 'branch' | 'author' | 'title' | 'timestamp';

// One per-column attribute line under a matrix header. Shared so branch and PR
// matrices render identical meta styling from a single place; Matrix keys these.
export function metaCell(variant: MetaVariant, text: ReactNode, title?: string): ReactNode {
    return <div className={`${styles.metaContent} ${styles[variant]}`} title={title}>{text}</div>;
}
