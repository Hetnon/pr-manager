export default function TechLeadActions({ matrix }) {
  const { sortedPrs, prSafe } = matrix;
  const peerSafe = sortedPrs.filter(pr => prSafe.get(pr.number));

  return (
    <div className="recommendations">
      <h2>Tech Lead Actions</h2>
      <div className="rec-section rec-ok">
        <h3>OK to check against master ({peerSafe.length})</h3>
        <p className="rec-tip">
          These PRs share no files with any other open PR. They can be evaluated against master independently — run your usual master-conflict check before merging.
        </p>
        {peerSafe.length === 0 ? (
          <p className="rec-item muted">None — every open PR shares at least one file with another.</p>
        ) : (
          <ul>
            {peerSafe.map(pr => (
              <li key={pr.number} className="rec-item">
                <strong>#{pr.number}</strong> — {pr.title}{' '}
                <span className="muted">({pr.author.login} · {pr.headRefName})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
