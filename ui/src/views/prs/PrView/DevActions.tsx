import type { PR } from '@shared/pr.js';
import type { SharedFileMatrix } from '../sharedFiles.js';
import styles from './DevActions.module.css';

interface Props {
    matrix: SharedFileMatrix;
}

interface SharedFile {
    path: string;
    prsForFile: PR[];
    authors: Set<string>;
}

export default function DevActions({ matrix }: Readonly<Props>) {
    const { sortedPrs, files } = matrix;
    if (sortedPrs.length === 0) return null;

    const prByNumber = new Map<number, PR>(sortedPrs.map((pr) => [pr.number, pr]));

    const sharedFiles: SharedFile[] = files
        .filter(([, prNumbers]) => prNumbers.length > 1)
        .map(([path, prNumbers]) => {
            const prsForFile = prNumbers.map((prNumber) => prByNumber.get(prNumber)!).filter(Boolean);
            const authors = new Set(prsForFile.map((pr) => pr.author.login));
            return { path, prsForFile, authors };
        });

    const sameAuthorFiles = sharedFiles.filter((sharedFile) => sharedFile.authors.size === 1);
    const byAuthor = new Map<string, SharedFile[]>();
    for (const sharedFile of sameAuthorFiles) {
        const author = [...sharedFile.authors][0];
        if (!byAuthor.has(author)) byAuthor.set(author, []);
        byAuthor.get(author)!.push(sharedFile);
    }
    const authorGroups = [...byAuthor.entries()].sort(([authorA], [authorB]) => authorA.localeCompare(authorB));

    return (
        <div className={styles.recommendations}>
            <h2>Dev Actions</h2>
            <div className={styles.recSection}>
                <h3>Resolve solo — same author owns all ({sameAuthorFiles.length}) PRs</h3>
                <p className={styles.recTip}>
                    For each file below, the same dev owns every PR touching it. No cross-team coordination needed.
                </p>
                {authorGroups.length === 0 ? (
                    <p className={`${styles.recItem} muted`}>No same-author conflicts — every shared file involves multiple devs.</p>
                ) : (
                    <ul>
                        {authorGroups.map(([author, filesForAuthor]) => (
                            <li key={author} className={styles.recItem}>
                                <strong>@{author}: pick your canonical version, remove the file from the other PRs of yours, and push.</strong>
                                <ul className={styles.sharedFiles}>
                                    {filesForAuthor.map((sharedFile) => (
                                        <li key={sharedFile.path}>
                                            <code>{sharedFile.path}</code> — in {sharedFile.prsForFile.map((pr) => `#${pr.number}`).join(', ')}
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
