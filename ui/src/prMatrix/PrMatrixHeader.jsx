import styles from './PrMatrix.module.css';

export default function PrMatrixHeader({ sortedPrs, fileCount, prSafe, expanded, onToggle, fileColRef, fileColMinWidth }) {
  const fileColStyle = fileColMinWidth ? { minWidth: `${fileColMinWidth}px` } : undefined;
  return (
    <thead>
      <tr>
        <th ref={fileColRef} className={`${styles.fileCol} ${styles.rowLabel}`} style={fileColStyle}>PR #</th>
        <th rowSpan={4} className={styles.statusCol}>Safe?</th>
        {sortedPrs.map(pr => {
          const safe = prSafe.get(pr.number);
          const status = `GitHub: ${pr.mergeStateStatus} | ${pr.mergeable}`;
          return (
            <th key={pr.number} className={`${styles.prCol} ${safe ? styles.prSafe : styles.prConflict}`} title={status}>
              <button className="pr-link" onClick={() => window.open(`https://github.com/pulls?q=${pr.number}`, '_blank')}>#{pr.number}</button>
            </th>
          );
        })}
      </tr>
      <tr className={styles.prMetaRow}>
        <th className={`${styles.fileCol} ${styles.rowLabel}`}>Branch Name</th>
        {sortedPrs.map(pr => (
          <td key={pr.number} className={styles.prMetaCell}>
            <div className={`${styles.prMetaContent} ${styles.branch}`} title={pr.headRefName}>{pr.headRefName}</div>
          </td>
        ))}
      </tr>
      <tr className={styles.prMetaRow}>
        <th className={`${styles.fileCol} ${styles.rowLabel}`}>Dev's Name</th>
        {sortedPrs.map(pr => (
          <td key={pr.number} className={styles.prMetaCell}>
            <div className={`${styles.prMetaContent} ${styles.author}`} title={pr.author.login}>{pr.author.login}</div>
          </td>
        ))}
      </tr>
      <tr className={styles.prMetaRow}>
        <th className={`${styles.fileCol} ${styles.rowLabel}`}>PR Name</th>
        {sortedPrs.map(pr => (
          <td key={pr.number} className={styles.prMetaCell}>
            <div className={`${styles.prMetaContent} ${styles.title}`} title={pr.title}>{pr.title}</div>
          </td>
        ))}
      </tr>
      <tr className={styles.footerRow}>
        <th className={`${styles.fileCol} ${styles.rowLabel}`}>
          <button className={styles.rowToggle} onClick={onToggle} aria-expanded={expanded} title={expanded ? 'Hide file rows' : 'Show file rows'}>
            <span className={styles.triangle}>{expanded ? '▼' : '▶'}</span>
            <strong>Good to Merge? ({fileCount} files)</strong>
          </button>
        </th>
        <td className={styles.statusCell} />
        {sortedPrs.map(pr => {
          const safe = prSafe.get(pr.number);
          return <td key={pr.number} className={`${styles.statusCell} ${safe ? styles.safe : styles.conflict}`}>{safe ? '✓' : '✗'}</td>;
        })}
      </tr>
    </thead>
  );
}
