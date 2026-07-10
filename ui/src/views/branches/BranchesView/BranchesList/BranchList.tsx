import { useContext } from 'react';
import type { PR } from '@shared/pr.js';
import type { Branch } from '../../types.js';
import { RepoContext } from '../../../../repo/RepoContext.js';
import { usePushBranch } from './usePushBranch.js';
import { useOpenPr } from './useOpenPr.js';
import styles from './BranchList.module.css';
import { AnalysisContext } from '../../../AnalysisContext.js';
import BranchListHeader from './BranchListHeader.js';
import BranchRow from './BranchRow.js';

// The branch "table": a header row + one row per branch, with push / open-PR
// actions per row and each action's outcome in that row's Status column. A flex
// layout, not a <table> — fixed column widths keep header and rows aligned. Owns
// those actions itself, since they're only triggered from here. (Closing a PR
// lives in the PR view.)
export default function BranchList() {
    const { prs, loadPrs, branchesAnalysis } = useContext(AnalysisContext);
    const { snapshot, worktree, refresh } = branchesAnalysis;
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const { pushingBranch, lastPushByBranch, pushBranch } = usePushBranch(snapshot, refresh, loadPrs);
    const { openingPr, lastPrByBranch, openPr } = useOpenPr(snapshot, refresh, loadPrs);

    if (!snapshot?.branches || snapshot.branches.length === 0) return null;

    const defaultBranch = snapshot.defaultBranch;
    const prByRef = new Map<string, PR>();
    for (const pr of prs ?? []) prByRef.set(pr.headRefName, pr);

    // Default branch first, then the current branch, then the rest in their existing order
    const sortRank = (branch: Branch): number => {
        if (branch.name === defaultBranch) return 0;
        if (branch.current) return 1;
        return 2;
    };
    const branches: Branch[] = snapshot.branches
        .map((branch) => ({ ...branch, pr: prByRef.get(branch.name) ?? null }))
        .sort((a, b) => sortRank(a) - sortRank(b));

    const worktreeDirty = !!worktree && !worktree.clean;
    // Show the explainer note only when the asymmetry is actually on screen: the
    // current branch is dirty (its actions are greyed) AND some other branch is
    // still pushable.
    const hasOtherPushable = branches.some((branch) =>
        !branch.current
        && branch.name !== defaultBranch
        && branch.aheadOfDefault > 0
        && !!owner && !!repo,
    );

    return (
        <div className={styles.list}>
            <div className={styles.listHeader}>
                {snapshot.branches.length} Branch{snapshot.branches.length === 1 ? '' : 'es'} total
            </div>
            <BranchListHeader />

            {branches.map((branch) => (
                <BranchRow
                    key={branch.name}
                    branch={branch}
                    pushingBranch={pushingBranch}
                    openingPr={openingPr}
                    pushBranch={pushBranch}
                    openPr={openPr}
                    pushOutcome={lastPushByBranch.get(branch.name) ?? null}
                    prOutcome={lastPrByBranch.get(branch.name) ?? null}
                />
            ))}
            {worktreeDirty && hasOtherPushable && (
                <div className={styles.listFootnote}>
                    Other branches push their committed tip — only the checked-out branch has a working tree, so only it can be dirty.
                </div>
            )}
        </div>
    );
}
