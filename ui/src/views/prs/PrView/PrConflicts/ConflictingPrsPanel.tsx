import { useContext } from 'react';
import { PrConflictsContext } from './PrConflictsContext.js';
import styles from './PrConflicts.module.css';

// Lists PRs that share files with other open PRs, with a checkbox to promote one into the
// base check and a button to close it. Shown before the matrix so a tech lead can see what
// they're choosing between before promoting.
export default function ConflictingPrsPanel() {
    const { nonGreens, promoted, togglePromoted, conflictsByPr, close, closingPr } = useContext(PrConflictsContext);
    return (
        <div className={styles.conflictPanel}>
            <strong className={styles.conflictTitle}>Conflicting PRs ({nonGreens.length})</strong>
            <p className={styles.conflictIntro}>
                These share files with other open PRs. Promote one (or more) to evaluate against the base branch.
                If clean, you can squash-merge it below; then refresh to re-check the rest.
            </p>
            <ul className={styles.conflictList}>
                {nonGreens.map((pr) => {
                    const conflicts = conflictsByPr.get(pr.number) ?? [];
                    const isPromoted = promoted.has(pr.number);
                    return (
                        <li key={pr.number} className={styles.conflictItem}>
                            <div className={styles.conflictRow}>
                                <label className={styles.conflictLabel}>
                                    <input
                                        type="checkbox"
                                        checked={isPromoted}
                                        onChange={(event) => togglePromoted(pr.number, event.target.checked)}
                                        className={styles.conflictCheckbox}
                                    />
                                    <div className={styles.conflictBody}>
                                        <div>
                                            <a href={pr.url} target="_blank" rel="noreferrer"><strong>#{pr.number}</strong></a>
                                            {' '}— {pr.title}{' '}
                                            <span className={styles.conflictMeta}>({pr.author.login} · <code>{pr.headRefName}</code>)</span>
                                            {isPromoted && (
                                                <span className={styles.conflictPromoted}>
                                                    ✓ promoted
                                                </span>
                                            )}
                                        </div>
                                        <ul className={styles.conflictFiles}>
                                            {conflicts.map(({ file, others }) => (
                                                <li key={file}>
                                                    <code>{file}</code> — also in {others.map((otherPrNumber) => `#${otherPrNumber}`).join(', ')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => close(pr.number)}
                                    disabled={closingPr !== null}
                                    title="Close this PR without merging (reopenable on GitHub)"
                                    className={styles.conflictCloseBtn}
                                >
                                    {closingPr === pr.number ? 'Closing…' : 'Close PR'}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
