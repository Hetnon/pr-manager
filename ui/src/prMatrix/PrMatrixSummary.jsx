import styles from './PrMatrix.module.css';

export default function PrMatrixSummary({ safeCount, totalPrs, hotFileCount }) {
  return (
    <div className={styles.summary}>
      <strong>{safeCount}</strong> of <strong>{totalPrs}</strong> PR(s) safe to merge independently. Hot files: {hotFileCount}
    </div>
  );
}
