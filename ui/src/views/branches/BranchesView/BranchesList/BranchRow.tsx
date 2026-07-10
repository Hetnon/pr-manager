import { useContext, type JSX, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import type { Branch, PushOutcome, PrOutcome } from '../../types.js';
import type { LocalBranch } from '../../readLocalRepo.js';
import { RepoContext } from '../../../../repo/RepoContext.js';
import { AnalysisContext } from '../../../AnalysisContext.js';
import { formatDateTime } from '../../../../lib/formatDate.js';
import styles from './BranchList.module.css';
import BranchActionsButtons from './BranchActionsButtons.js';
import BranchStatusCell from './BranchStatusCell/BranchStatusCell.js';

interface BranchRowProps {
    branch: Branch;
    pushingBranch: string | null;
    openingPr: string | null;
    pushBranch: (branch: LocalBranch, existingPr?: PR | null) => void;
    openPr: (branch: LocalBranch) => void;
    pushOutcome: PushOutcome | null;
    prOutcome: PrOutcome | null;
}

function formatCount(count: number, truncated: boolean): string {
    if (truncated) return `${count}+`;
    return String(count);
}

// One branch's row. Reads repo/analysis state from context; the list-wide push /
// open-PR action state is owned by BranchList and passed down.
export default function BranchRow({
    branch, pushingBranch, openingPr, pushBranch, openPr, pushOutcome, prOutcome,
}: Readonly<BranchRowProps>): JSX.Element {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const defaultBranch = branchesAnalysis.snapshot?.defaultBranch ?? null;
    const worktreeDirty = !!branchesAnalysis.worktree && !branchesAnalysis.worktree.clean;

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
            />
            <div className={styles.colStatus}>
                <BranchStatusCell push={pushOutcome} pr={prOutcome} isCurrent={branch.current} />
            </div>
        </div>
    );
}
