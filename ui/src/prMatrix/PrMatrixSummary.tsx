import styles from './PrMatrix.module.css';

interface Props {
    safeCount: number;
    totalPrs: number;
    hotFileCount: number;
}

export default function PrMatrixSummary({ safeCount, totalPrs, hotFileCount }: Props) {
    return (
        <div className={styles.summary}>
            <strong>{safeCount}</strong> of <strong>{totalPrs}</strong> PR(s) safe to merge independently. Hot files: {hotFileCount}
        </div>
    );
}
