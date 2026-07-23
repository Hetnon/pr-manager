import type { LocalBranch } from '../../../readLocalRepo.js';
import type { PushOutcome, PrOutcome } from '../../../types.js';
import styles from '../BranchList.module.css';

// How a differing-from-origin branch relates to it, spelled out. `local differs` was
// ambiguous; behind/ahead/diverged tells the dev what action it implies (pull vs push
// vs reconcile). Reflects the last fetch, so it can lag origin by one refresh.
const DIFF_LABEL: Record<'ahead' | 'behind' | 'diverged', string> = {
    behind: 'On origin · local behind',
    ahead: 'On origin · local ahead',
    diverged: 'On origin · diverged',
};
const DIFF_TITLE: Record<'ahead' | 'behind' | 'diverged', string> = {
    behind: 'origin/… has commits your local branch doesn’t — pull/fast-forward to catch up.',
    ahead: 'your local branch has commits origin doesn’t — push to update origin.',
    diverged: 'both your local branch and origin/… have commits the other lacks — reconcile (rebase/merge).',
};

// Where a branch lives: local-only vs on origin (with how it relates), plus any fresh
// in-app push/open-PR outcome (the most current truth — a just-pushed branch reads "on
// origin" before the next fetch refreshes remoteSha). Working-tree state is a separate column.
export default function LocationCell({
    push, pr, remoteRelation,
}: Readonly<{
    push: PushOutcome | null;
    pr: PrOutcome | null;
    remoteRelation: LocalBranch['remoteRelation'];
}>) {
    if (push || pr) {
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
    if (remoteRelation === 'local-only') return <span className={styles.dash}>Local only</span>;
    if (remoteRelation === 'synced') return <span className="ok">✓ On origin</span>;
    return (
        <span className={styles.dash} title={DIFF_TITLE[remoteRelation]}>
            {DIFF_LABEL[remoteRelation]}
        </span>
    );
}
