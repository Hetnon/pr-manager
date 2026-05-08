export default function PrMatrixHeader({ sortedPrs, fileCount, prSafe, expanded, onToggle, fileColRef, fileColMinWidth }) {
  const fileColStyle = fileColMinWidth ? { minWidth: `${fileColMinWidth}px` } : undefined;
  return (
    <thead>
      <tr>
        <th ref={fileColRef} className="file-col" style={fileColStyle}>File ({fileCount})</th>
        <th className="status-col">Safe?</th>
        {sortedPrs.map(pr => {
          const title = `${pr.title}\nBranch: ${pr.headRefName}\nAuthor: ${pr.author.login}\nGitHub: ${pr.mergeStateStatus} | ${pr.mergeable}`;
          const safe = prSafe.get(pr.number);
          return (
            <th key={pr.number} className={`pr-col ${safe ? 'pr-safe' : 'pr-conflict'}`} title={title}>
              <button className="pr-link" onClick={() => window.open(`https://github.com/pulls?q=${pr.number}`, '_blank')}>#{pr.number}</button>
              <div className="pr-branch">{pr.headRefName}</div>
            </th>
          );
        })}
      </tr>
      <tr className="footer-row">
        <td className="file-col">
          <button className="row-toggle" onClick={onToggle} aria-expanded={expanded} title={expanded ? 'Hide file rows' : 'Show file rows'}>
            <span className="triangle">{expanded ? '▼' : '▶'}</span>
            <strong>Good to Merge?</strong>
          </button>
        </td>
        <td className="status-cell" />
        {sortedPrs.map(pr => {
          const safe = prSafe.get(pr.number);
          return <td key={pr.number} className={`status-cell ${safe ? 'safe' : 'conflict'}`}>{safe ? '✓' : '✗'}</td>;
        })}
      </tr>
    </thead>
  );
}
