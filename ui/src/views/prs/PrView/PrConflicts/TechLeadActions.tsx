import { useContext } from 'react';
import { PrConflictsContext } from './PrConflictsContext.js';
import styles from './TechLeadActions.module.css';

// The merge panel: PRs clean against the base branch, each with a one-click squash-merge
// (via the GitHub API), a "delete branch" opt-out, and a close button. Also surfaces the
// outcome of the last merge attempt.
export default function TechLeadActions() {
    const {
        readyToMerge, lastMerge, merging, closingPr, skipBranchDelete, toggleSkipBranchDelete, handleMerge, close,
    } = useContext(PrConflictsContext);
    return (
        <div className={styles.mergeReady}>
            <h3>Tech Lead Actions ({readyToMerge.length})</h3>
            <p className={styles.mergeIntro}>
                One-click squash-merge via the GitHub API. Branch protection / required checks still apply.
            </p>
            {lastMerge && (
                <div className={lastMerge.ok ? styles.mergeSuccess : styles.mergeWarn}>
                    <strong>
                        {lastMerge.ok ? `✓ Merged #${lastMerge.prNumber}` : `⚠ Couldn't merge #${lastMerge.prNumber}`}
                    </strong>
                    {lastMerge.ok ? (
                        <>
                            <ol>{lastMerge.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                            {lastMerge.branchDeleteError && (
                                <p className={styles.branchDeleteError}>
                                    ⚠ Branch wasn't deleted: {lastMerge.branchDeleteError}
                                </p>
                            )}
                        </>
                    ) : (
                        <p>{lastMerge.message}</p>
                    )}
                </div>
            )}
            <ul className={styles.mergeList}>
                {readyToMerge.map((pr) => (
                    <li key={pr.number}>
                        <span><strong>#{pr.number}</strong> — {pr.title} <span className={styles.muted}>({pr.author.login} · {pr.headRefName})</span></span>
                        <label className={styles.deleteBranchLabel}>
                            <input
                                type="checkbox"
                                checked={!skipBranchDelete.has(pr.number)}
                                onChange={(event) => toggleSkipBranchDelete(pr.number, !event.target.checked)}
                                disabled={merging !== null}
                            />
                            Delete branch
                        </label>
                        <button
                            className={`primary ${styles.mergeBtn}`}
                            onClick={() => handleMerge(pr.number)}
                            disabled={merging !== null || closingPr !== null}
                        >
                            {merging === pr.number ? 'Merging…' : 'Squash & merge'}
                        </button>
                        <button
                            type="button"
                            onClick={() => close(pr.number)}
                            disabled={merging !== null || closingPr !== null}
                            title="Close this PR without merging (reopenable on GitHub)"
                        >
                            {closingPr === pr.number ? 'Closing…' : 'Close PR'}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
