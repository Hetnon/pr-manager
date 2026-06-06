import type { PR } from '@shared/pr.js';
import type { LastMerge } from '../types.js';
import styles from './TechLeadActions.module.css';

interface Props {
    readyToMerge: PR[];
    lastMerge: LastMerge;
    merging: number | null;
    closingPr: number | null;
    skipBranchDelete: Set<number>;
    onToggleSkipBranchDelete: (prNumber: number, skip: boolean) => void;
    onMerge: (prNumber: number) => void;
    onClose: (prNumber: number) => void;
}

// The merge panel: PRs that are clean against master, each with a one-click
// squash-merge (via the GitHub API), a "delete branch" opt-out, and a close
// button. Also surfaces the outcome of the last merge attempt.
export default function TechLeadActions({
    readyToMerge,
    lastMerge,
    merging,
    closingPr,
    skipBranchDelete,
    onToggleSkipBranchDelete,
    onMerge,
    onClose,
}: Props) {
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
                                <p style={{ marginTop: 4, color: '#9a6700', fontSize: 12 }}>
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
                        <span><strong>#{pr.number}</strong> — {pr.title} <span className="muted">({pr.author.login} · {pr.headRefName})</span></span>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#57606a', whiteSpace: 'nowrap' }}>
                            <input
                                type="checkbox"
                                checked={!skipBranchDelete.has(pr.number)}
                                onChange={(event) => onToggleSkipBranchDelete(pr.number, !event.target.checked)}
                                disabled={merging !== null}
                            />
                            Delete branch
                        </label>
                        <button
                            className={`primary ${styles.mergeBtn}`}
                            onClick={() => onMerge(pr.number)}
                            disabled={merging !== null || closingPr !== null}
                        >
                            {merging === pr.number ? 'Merging…' : 'Squash & merge'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onClose(pr.number)}
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
