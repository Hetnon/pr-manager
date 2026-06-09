import { useContext } from 'react';
import type { LocalRepoSnapshot } from '../readLocalRepo.js';
import type { WorkingTreeStatus } from '../workingTreeStatus.js';
import type { Row } from '../types.js';
import { RepoContext } from '../../../repo/RepoContext.js';
import { useClosePr } from '../../../hooks/useClosePr.js';
import { usePushBranch } from '../hooks/usePushBranch.js';
import { useOpenPr } from '../hooks/useOpenPr.js';
import { formatDateTime } from '../../../lib/formatDate.js';
import styles from '../BranchesView.module.css';

interface Props {
    rows: Row[];
    snapshot: LocalRepoSnapshot;
    worktree: WorkingTreeStatus | null;
    refresh: (currentRepoFolderHandle: FileSystemDirectoryHandle) => Promise<void>;
    onPushed?: () => void;
}

function formatCount(count: number, truncated: boolean): string {
    if (truncated) return `${count}+`;
    return String(count);
}

// The branch "table": a header row + one row per branch, with push / open-PR /
// close actions per row. A flex layout, not a <table> — fixed column widths keep
// header and rows aligned. Owns those actions (and their result banners) itself,
// since they're only triggered from here.
export default function BranchList({ rows, snapshot, worktree, refresh, onPushed }: Props) {
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const defaultBranch = snapshot.defaultBranch;
    const { pushingBranch, lastPush, pushBranch } = usePushBranch(snapshot, refresh, onPushed);
    const { openingPr, lastPr, openPr } = useOpenPr(snapshot, refresh, onPushed);
    const { closingPr, lastClose, close } = useClosePr(onPushed);
    const busy = pushingBranch !== null || openingPr !== null;

    const worktreeDirty = !!worktree && !worktree.clean;
    // Show the explainer note only when the asymmetry is actually on screen: the
    // current branch is dirty (its actions are greyed) AND some other branch is
    // still pushable.
    const hasOtherPushable = rows.some(({ branch }) =>
        !branch.current
        && branch.name !== defaultBranch
        && branch.aheadOfDefault > 0
        && !!owner && !!repo,
    );

    return (
        <>
            {lastPush && (
                <p className={`${styles.message} ${lastPush.ok ? styles.ok : styles.bad}`}>
                    {lastPush.ok
                        ? <>✓ Pushed <code>{lastPush.branch}</code> to origin{lastPush.updatedPr && <> (updated <a href={lastPush.updatedPr.url} target="_blank" rel="noreferrer">PR #{lastPush.updatedPr.number}</a>)</>}</>
                        : <>✗ <code>{lastPush.branch}</code>: {lastPush.message}</>}
                </p>
            )}
            {lastPr && (
                <p className={`${styles.message} ${lastPr.ok ? styles.ok : styles.bad}`}>
                    {lastPr.ok
                        ? <>✓ Pushed <code>{lastPr.branch}</code> and opened <a href={lastPr.prUrl} target="_blank" rel="noreferrer">PR #{lastPr.prNumber}</a></>
                        : <>✗ <code>{lastPr.branch}</code>: {lastPr.message}</>}
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
                    // Backup-push is offered for any non-default branch that's ahead,
                    // even one with an open PR (pushing updates that PR). Opening a PR
                    // is gated on there being none yet.
                    const canPush = !isDefault && branch.aheadOfDefault > 0 && !!owner && !!repo;
                    const canOpenPr = canPush && !pr;
                    // The working tree belongs only to the current branch, so a dirty
                    // tree greys *its* actions (a push/PR would silently omit the
                    // uncommitted work, and there's no in-app commit). Other branches
                    // push their committed refs regardless.
                    const blockedByDirty = branch.current && worktreeDirty;
                    const dirtyTitle = blockedByDirty
                        ? 'Working tree has uncommitted changes — commit or stash them first (the app has no commit action).'
                        : undefined;
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
                                {canPush && (
                                    <button
                                        type="button"
                                        onClick={() => pushBranch(branch, pr)}
                                        disabled={busy || blockedByDirty}
                                        title={dirtyTitle}
                                    >
                                        {pushingBranch === branch.name ? 'Pushing…' : 'Push'}
                                    </button>
                                )}
                                {canOpenPr && (
                                    <button
                                        type="button"
                                        onClick={() => openPr(branch)}
                                        disabled={busy || blockedByDirty}
                                        title={dirtyTitle}
                                    >
                                        {openingPr === branch.name ? 'Opening…' : 'Push & Open PR'}
                                    </button>
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
