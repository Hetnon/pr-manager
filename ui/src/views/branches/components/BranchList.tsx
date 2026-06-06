import { useContext } from 'react';
import type { LocalRepoSnapshot } from '../readLocalRepo.js';
import type { WorkingTreeStatus } from '../workingTreeStatus.js';
import type { Row } from '../types.js';
import { RepoContext } from '../../../repo/RepoContext.js';
import { useClosePr } from '../../../hooks/useClosePr.js';
import { usePushBranch } from '../hooks/usePushBranch.js';
import { formatDateTime } from '../../../lib/formatDate.js';
import styles from '../BranchesView.module.css';

interface Props {
    rows: Row[];
    snapshot: LocalRepoSnapshot;
    worktree: WorkingTreeStatus | null;
    refresh: (folderHandle: FileSystemDirectoryHandle) => Promise<void>;
    onPushed?: () => void;
}

function formatCount(count: number, truncated: boolean): string {
    if (truncated) return `${count}+`;
    return String(count);
}

// The branch "table": a header row + one row per branch, with push / close
// actions per row. A flex layout, not a <table> — fixed column widths keep
// header and rows aligned. Owns the push and close actions (and their result
// banners) itself, since they're only triggered from here.
export default function BranchList({ rows, snapshot, worktree, refresh, onPushed }: Props) {
    const { folderHandle, repoOwnerAndName } = useContext(RepoContext);
    const owner = repoOwnerAndName?.owner ?? null;
    const repo = repoOwnerAndName?.name ?? null;
    const defaultBranch = snapshot.defaultBranch;
    const { pushingBranch, lastPush, pushBranch } = usePushBranch(folderHandle, owner, repo, snapshot, refresh, onPushed);
    const { closingPr, lastClose, close } = useClosePr(owner, repo, onPushed);

    const worktreeDirty = !!worktree && !worktree.clean;
    // Show the explainer note only when the asymmetry is actually on screen: the
    // current branch is dirty (its Push is blocked) AND some other branch still
    // offers Push.
    const hasOtherPushable = rows.some(({ branch, pr }) =>
        !branch.current
        && branch.name !== defaultBranch
        && !pr
        && branch.aheadOfDefault > 0
        && !!owner && !!repo,
    );

    return (
        <>
            {lastPush && (
                <p className={`${styles.message} ${lastPush.ok ? styles.ok : styles.bad}`}>
                    {lastPush.ok
                        ? <>✓ Pushed <code>{lastPush.branch}</code> and opened <a href={lastPush.prUrl} target="_blank" rel="noreferrer">PR #{lastPush.prNumber}</a></>
                        : <>✗ <code>{lastPush.branch}</code>: {lastPush.message}</>}
                </p>
            )}
            {lastClose && (
                <p className={`${styles.message} ${lastClose.ok ? styles.ok : styles.bad}`}>
                    {lastClose.ok ? `✓ ${lastClose.message}` : `✗ Couldn't close #${lastClose.prNumber}: ${lastClose.message}`}
                </p>
            )}
            <div className={styles.list}>
                <div className={styles.rowHeader}>
                    <div className={styles.colBranch}>Branch</div>
                    <div className={styles.colPr}>PR</div>
                    <div className={styles.colHead}>HEAD</div>
                    <div className={styles.colNum}>Ahead</div>
                    <div className={styles.colNum}>Behind</div>
                    <div className={styles.colCommit}>Last commit</div>
                    <div className={styles.colActions}>Actions</div>
                </div>
                {rows.map(({ branch, pr }) => {
                    const isDefault = branch.name === defaultBranch;
                    const canPush = !isDefault && !pr && branch.aheadOfDefault > 0 && !!owner && !!repo;
                    // The working tree belongs to the current branch, so a dirty
                    // tree only blocks pushing *that* branch — its PR would omit
                    // the uncommitted work. Other branches push their committed
                    // refs regardless.
                    const blockedByDirty = canPush && branch.current && !!worktree && !worktree.clean;
                    return (
                        <div key={branch.name} className={styles.rowBody}>
                            <div className={styles.colBranch} title={branch.name}>
                                {branch.current && <span title="current branch">● </span>}
                                <code>{branch.name}</code>
                            </div>
                            <div className={styles.colPr}>
                                {pr
                                    ? <a href={pr.url} target="_blank" rel="noreferrer">#{pr.number}</a>
                                    : <span className={styles.dash}>—</span>}
                            </div>
                            <div className={styles.colHead}><code>{branch.sha.slice(0, 8)}</code></div>
                            <div className={styles.colNum}>
                                {isDefault ? '—' : formatCount(branch.aheadOfDefault, branch.truncated)}
                            </div>
                            <div className={styles.colNum}>
                                {isDefault ? '—' : formatCount(branch.behindDefault, branch.truncated)}
                            </div>
                            <div className={styles.colCommit}>
                                {branch.error
                                    ? <span className={styles.bad}>{branch.error}</span>
                                    : branch.head
                                        ? <span title={`${branch.head.authorName} · ${formatDateTime(branch.head.date)}`}>{branch.head.message}</span>
                                        : '—'}
                            </div>
                            <div className={styles.colActionsCell}>
                                {canPush && !blockedByDirty && (
                                    <button
                                        type="button"
                                        onClick={() => pushBranch(branch)}
                                        disabled={pushingBranch !== null}
                                    >
                                        {pushingBranch === branch.name ? 'Pushing…' : 'Push & open PR'}
                                    </button>
                                )}
                                {blockedByDirty && (
                                    <span
                                        className={styles.blockedNote}
                                        title="Working tree has uncommitted changes — commit or stash before pushing"
                                    >
                                        Can't push — working tree dirty
                                    </span>
                                )}
                                {pr && (
                                    <button
                                        type="button"
                                        onClick={() => close(pr.number, pr.title)}
                                        disabled={closingPr !== null}
                                        title="Close this PR without merging (reopenable on GitHub)"
                                    >
                                        {closingPr === pr.number ? 'Closing…' : 'Close PR'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {worktreeDirty && hasOtherPushable && (
                    <div className={styles.listFootnote}>
                        Other branches push their committed tip — only the checked-out branch has a working tree, so only it can be dirty.
                    </div>
                )}
            </div>
        </>
    );
}
