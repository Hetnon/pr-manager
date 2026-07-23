import { useContext, type JSX, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import type { Branch, PushOutcome, PrOutcome } from '../../types.js';
import type { LocalBranch } from '../../readLocalRepo.js';
import { RepoContext } from '../../../../repo/RepoContext.js';
import { AnalysisContext } from '../../../AnalysisContext.js';
import { formatDateTime } from '../../../../lib/formatDate.js';
import styles from './BranchList.module.css';
import BranchActionsButtons from './BranchActionsButtons.js';
import LocationCell from './BranchStatusCell/LocationCell.js';
import WorkingTreeBanner from './BranchStatusCell/WorkingTreeBanner/WorkingTreeBanner.js';

interface BranchRowProps {
    branch: Branch;
    defaultBranch: string | null;
    pushingBranch: string | null;
    openingPr: string | null;
    pushBranch: (branch: LocalBranch, existingPr?: PR | null) => void;
    openPr: (branch: LocalBranch) => void;
    pushOutcome: PushOutcome | null;
    prOutcome: PrOutcome | null;
    lifecycleBusy: boolean;
    lifecycleProgress: string | null;
    lifecycleError: string | null;
    onDelete: () => void;
    onDeleteCurrent: () => void;
    onSwitch: () => void;
}

function formatCount(count: number, truncated: boolean): string {
    if (truncated) return `${count}+`;
    return String(count);
}

// One branch's row. Reads repo/analysis state from context; the list-wide push /
// open-PR action state is owned by BranchList and passed down.
export default function BranchRow({
    branch, defaultBranch, pushingBranch, openingPr, pushBranch, openPr, pushOutcome, prOutcome,
    lifecycleBusy, lifecycleProgress, lifecycleError, onDelete, onDeleteCurrent, onSwitch,
}: Readonly<BranchRowProps>): JSX.Element {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const worktree = branchesAnalysis.worktree;
    const worktreeDirty = !!worktree && !worktree.clean;

    const { pr } = branch;
    const isDefault = branch.name === defaultBranch;
    // Backup-push is offered for any non-default branch that's ahead, even one with
    // an open PR (pushing updates that PR). Opening a PR is gated on there being none yet.
    const canPush = !isDefault && branch.aheadOfDefault > 0 && !!owner && !!repo;
    const canOpenPr = canPush && !pr;
    // The working tree belongs only to the current branch, so a dirty tree greys
    // *its* actions (a push/PR would silently omit the uncommitted work, and there's
    // no in-app commit). Other branches push their committed refs regardless.
    const blockedByDirty = branch.current && worktreeDirty;
    const dirtyTitle = blockedByDirty
        ? 'Working tree has uncommitted changes — commit or stash them first (the app has no commit action).'
        : undefined;
    const busy = pushingBranch !== null || openingPr !== null;

    // Row admin button: the current branch offers Switch (a prerequisite to deleting
    // it), every other non-default branch offers Delete. The default branch is
    // protected (no admin button). Delete is "suggested" (highlighted) when the branch
    // was on origin but is now gone — i.e. most likely already merged.
    const suggestDelete = branch.hadUpstream && !branch.remoteSha && !branch.current && !isDefault;
    let adminButton: ReactNode = null;
    if (branch.current && !isDefault) {
        // The current branch offers both: Switch (clean end-state, rewrites the tree)
        // and Delete (detach at the same commit — instant, no rewrite, detached HEAD).
        adminButton = (
            <>
                {defaultBranch && (
                    <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={onSwitch}
                        disabled={lifecycleBusy || worktreeDirty}
                        title={worktreeDirty
                            ? 'Commit or stash your changes before switching — checkout would overwrite them.'
                            : `Switch to ${defaultBranch} (checks out its files — slow for a far branch).`}
                    >
                        {lifecycleBusy ? (lifecycleProgress ?? 'Switching…') : `Switch to ${defaultBranch}`}
                    </button>
                )}
                <button
                    type="button"
                    className={`${styles.secondaryAction} ${styles.deleteButton}`}
                    onClick={onDeleteCurrent}
                    disabled={lifecycleBusy}
                    title="Delete this branch now — HEAD detaches at the same commit (instant, no files change; leaves a detached HEAD)."
                >
                    {lifecycleBusy && !lifecycleProgress ? 'Deleting…' : 'Delete'}
                </button>
            </>
        );
    } else if (!isDefault) {
        adminButton = (
            <button
                type="button"
                className={`${styles.secondaryAction} ${suggestDelete ? styles.deleteSuggested : styles.deleteButton}`}
                onClick={onDelete}
                disabled={lifecycleBusy}
                title={suggestDelete
                    ? 'This branch was on origin but is gone now (most likely merged) — safe to delete locally.'
                    : 'Delete this branch from your machine (origin is not affected).'}
            >
                {lifecycleBusy ? 'Deleting…' : 'Delete'}
            </button>
        );
    }

    let commitCell: ReactNode = '—';
    if (branch.error) {
        commitCell = <span className="bad">{branch.error}</span>;
    } else if (branch.head) {
        commitCell = <span title={`${branch.head.authorName} · ${formatDateTime(branch.head.date)}`}>{branch.head.message}</span>;
    }

    return (
        <div className={styles.rowBody}>
            <div className={styles.colBranch} title={branch.name}>
                {isDefault && <span title="Default branch">● <strong>Default Branch: </strong></span>}
                {branch.current && <span title="Current branch">● <strong>Current Branch: </strong></span>}
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
            <div className={styles.colCommit}>{commitCell}</div>
            <BranchActionsButtons
                canPush={canPush}
                canOpenPr={canOpenPr}
                disabled={busy || blockedByDirty}
                disabledTitle={dirtyTitle}
                isPushing={pushingBranch === branch.name}
                isOpening={openingPr === branch.name}
                onPush={() => pushBranch(branch, pr)}
                onOpenPr={() => openPr(branch)}
                trailing={adminButton}
                error={lifecycleError}
            />
            <div className={styles.colWorkingTree}>
                {/* The working tree belongs to whatever branch is checked out, so only
                    the current branch has a clean/dirty state; others show nothing. */}
                {branch.current ? <WorkingTreeBanner /> : <span className={styles.dash}>—</span>}
            </div>
            <div className={styles.colLocation}>
                <LocationCell push={pushOutcome} pr={prOutcome} remoteRelation={branch.remoteRelation} />
            </div>
        </div>
    );
}
