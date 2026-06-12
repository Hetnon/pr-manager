import styles from './MatrixLegend.module.css';

// Explains what the matrix's dots and colors mean — the dot is presence only;
// the cell color carries the 3-way-merge verdict.
export default function MatrixLegend() {
    return (
        <div className={styles.legend}>
            <span className={styles.legendItem}><span className={styles.legendDot}>●</span> = branch touches this file (presence)</span>
            <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchSafe}`} /> only one branch — safe</span>
            <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchIdentical}`} /> identical content</span>
            <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchClean}`} /> shared, non-overlapping (clean merge)</span>
            <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchConflict}`} /> real conflict</span>
            <span className={styles.italic}>hover a row's status for details</span>
        </div>
    );
}
