import { useMemo } from 'react';
import type { PR } from '@shared/pr.js';
import { buildMatrix } from '../lib/matrix.js';

interface Props {
    prs: PR[];
}

interface SharedFile {
    path: string;
    prsForFile: PR[];
    authors: Set<string>;
}

export default function DevActions({ prs }: Props) {
    const matrix = useMemo(() => buildMatrix(prs), [prs]);
    if (prs.length === 0) return null;
    const { sortedPrs, files } = matrix;

    const prByNumber = new Map<number, PR>(sortedPrs.map((pr) => [pr.number, pr]));

    const sharedFiles: SharedFile[] = files
        .filter(([, prNums]) => prNums.length > 1)
        .map(([path, prNums]) => {
            const prsForFile = prNums.map((n) => prByNumber.get(n)!).filter(Boolean);
            const authors = new Set(prsForFile.map((pr) => pr.author.login));
            return { path, prsForFile, authors };
        });

    const sameAuthorFiles = sharedFiles.filter((sf) => sf.authors.size === 1);
    const byAuthor = new Map<string, SharedFile[]>();
    for (const sf of sameAuthorFiles) {
        const author = [...sf.authors][0];
        if (!byAuthor.has(author)) byAuthor.set(author, []);
        byAuthor.get(author)!.push(sf);
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
                                    {filesForAuthor.map((sf) => (
                                        <li key={sf.path}>
                                            <code>{sf.path}</code> — in {sf.prsForFile.map((pr) => `#${pr.number}`).join(', ')}
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
