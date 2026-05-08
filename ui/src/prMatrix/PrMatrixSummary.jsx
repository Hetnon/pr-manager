export default function PrMatrixSummary({ safeCount, totalPrs, hotFileCount }) {
  return (
    <div className="summary">
      <strong>{safeCount}</strong> of <strong>{totalPrs}</strong> PR(s) safe to merge independently. Hot files: {hotFileCount}
    </div>
  );
}
