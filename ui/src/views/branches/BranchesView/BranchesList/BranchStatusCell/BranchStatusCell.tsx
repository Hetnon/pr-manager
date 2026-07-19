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
//
// With no in-app push/PR outcome to report, the cell falls back to the branch's
// remote-tracking state (from the last fetch, so it can lag origin by one refresh)
// rather than assuming the branch is local: on origin & in sync, on origin at a
// different commit, or genuinely never pushed.
export default function BranchStatusCell({
    push, pr, isCurrent, localSha, remoteSha,
}: Readonly<{
    push: PushOutcome | null;
    pr: PrOutcome | null;
    isCurrent: boolean;
    localSha: string;
    remoteSha: string | null;
}>) {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const treeClean = !!branchesAnalysis.worktree && branchesAnalysis.worktree.clean;
    const failed = (push && !push.ok) || (pr && !pr.ok);
    const pushedClean = ((push?.ok ?? false) || (pr?.ok ?? false)) && treeClean;

    if (isCurrent && !failed && !pushedClean) return <WorkingTreeBanner />;

    if (!push && !pr) {
        if (!remoteSha) return <span className={styles.dash}>Branch still local</span>;
        if (remoteSha === localSha) return <span className="ok">✓ On origin</span>;
        return (
            <span className={styles.dash} title="origin/… points at a different commit than your local branch (as of the last fetch).">
                On origin · local differs
            </span>
        );
    }
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
