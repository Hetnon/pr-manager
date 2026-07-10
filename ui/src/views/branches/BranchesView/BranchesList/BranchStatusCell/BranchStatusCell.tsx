import { useContext } from 'react';
import type { PushOutcome, PrOutcome } from '../../../types.js';
import { AnalysisContext } from '../../../../AnalysisContext.js';
import styles from '../BranchList.module.css';
import WorkingTreeBanner from './WorkingTreeBanner/WorkingTreeBanner.js';

// One branch row's Status cell. Non-current rows show the last push / open-PR
// outcome (the row already names the branch, so the message omits it). The
// current branch additionally owns the working tree: once its work is pushed and
// the tree is clean the outcome is the whole story, but a dirty tree (which
// stales that push) or a not-yet-pushed state defers to WorkingTreeBanner.
export default function BranchStatusCell({
    push, pr, isCurrent,
}: Readonly<{ push: PushOutcome | null; pr: PrOutcome | null; isCurrent: boolean }>) {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const treeClean = !!branchesAnalysis.worktree && branchesAnalysis.worktree.clean;
    const failed = (push && !push.ok) || (pr && !pr.ok);
    const pushedClean = ((push?.ok ?? false) || (pr?.ok ?? false)) && treeClean;

    if (isCurrent && !failed && !pushedClean) return <WorkingTreeBanner />;

    if (!push && !pr) return <span className={styles.dash}>Branch still local</span>;
    return (
        <>
            {push && (
                <span className={push.ok ? 'ok' : 'bad'}>
                    {push.ok
                        ? <>✓ Pushed to origin{push.updatedPr && <> (updated <a href={push.updatedPr.url} target="_blank" rel="noreferrer">PR #{push.updatedPr.number}</a>)</>}</>
                        : <>✗ {push.message}</>}
                </span>
            )}
            {pr && (
                <span className={pr.ok ? 'ok' : 'bad'}>
                    {pr.ok
                        ? <>✓ Pushed and opened <a href={pr.prUrl} target="_blank" rel="noreferrer">PR #{pr.prNumber}</a></>
                        : <>✗ {pr.message}</>}
                </span>
            )}
        </>
    );
}
