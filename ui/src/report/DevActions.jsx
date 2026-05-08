export default function DevActions({ matrix }) {
  const { sortedPrs, files, prSafe } = matrix;

  // path -> [prNumbers] for O(1) lookup
  const fileOwners = new Map(files);

  const conflicts = sortedPrs
    .filter(pr => !prSafe.get(pr.number))
    .map(pr => {
      const sharedFiles = pr.files
        .map(f => f.path)
        .filter(path => (fileOwners.get(path)?.length ?? 0) > 1)
        .map(path => ({
          path,
          others: fileOwners.get(path).filter(n => n !== pr.number),
        }));
      return { pr, sharedFiles };
    });

  return (
    <div className="recommendations">
      <h2>Dev Actions</h2>
      <div className="rec-section rec-warn">
        <h3>Coordinate &amp; rebase ({conflicts.length})</h3>
        <p className="rec-tip">
          Each PR below shares files with at least one other open PR. After the tech lead picks a merge order, rebase your branch on the merged result. Talk to the listed authors first if your changes overlap logically (not just textually).
        </p>
        {conflicts.length === 0 ? (
          <p className="rec-item muted">No conflicting PRs.</p>
        ) : (
          <ul>
            {conflicts.map(({ pr, sharedFiles }) => (
              <li key={pr.number} className="rec-item">
                <strong>#{pr.number}</strong> — {pr.title}{' '}
                <span className="muted">({pr.author.login} · {pr.headRefName})</span>
                <ul className="shared-files">
                  {sharedFiles.map(sf => (
                    <li key={sf.path}>
                      <code>{sf.path}</code> shared with {sf.others.map(n => `#${n}`).join(', ')}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
