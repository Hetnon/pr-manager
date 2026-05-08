import { useMemo } from 'react';
import { buildMatrix } from '../lib/matrix.js';

export default function DevActions({ prs }) {
  const matrix = useMemo(() => buildMatrix(prs), [prs]);
  if (prs.length === 0) return null;
  const { sortedPrs, files } = matrix;

  // PR# -> PR object lookup (so we can map shared-file owners back to their author)
  const prByNumber = new Map(sortedPrs.map(pr => [pr.number, pr]));

  // Each shared file: who's touching it, and how many distinct authors
  const sharedFiles = files
    .filter(([, prNums]) => prNums.length > 1)
    .map(([path, prNums]) => {
      const prsForFile = prNums.map(n => prByNumber.get(n));
      const authors = new Set(prsForFile.map(pr => pr.author.login));
      return { path, prsForFile, authors };
    });

  // Bucket: same dev owns every PR touching this file — they can resolve solo.
  const sameAuthorFiles = sharedFiles.filter(sf => sf.authors.size === 1);
  const byAuthor = new Map();
  for (const sf of sameAuthorFiles) {
    const author = [...sf.authors][0];
    if (!byAuthor.has(author)) byAuthor.set(author, []);
    byAuthor.get(author).push(sf);
  }
  const authorGroups = [...byAuthor.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="recommendations">
      <h2>Dev Actions</h2>
      <div className="rec-section rec-warn">
        <h3>Resolve solo — same author owns all PRs ({sameAuthorFiles.length})</h3>
        <p className="rec-tip">
          For each file below, the same dev owns every PR touching it. No cross-team coordination needed.
        </p>
        {authorGroups.length === 0 ? (
          <p className="rec-item muted">No same-author conflicts — every shared file involves multiple devs.</p>
        ) : (
          <ul>
            {authorGroups.map(([author, filesForAuthor]) => (
              <li key={author} className="rec-item">
                <strong>@{author}: pick your canonical version, remove the file from the other PRs of yours, and push.</strong>
                <ul className="shared-files">
                  {filesForAuthor.map(sf => (
                    <li key={sf.path}>
                      <code>{sf.path}</code> — in {sf.prsForFile.map(pr => `#${pr.number}`).join(', ')}
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
