import type { BranchVsDefault } from '../checkLocalConflicts.js';
import styles from '../BranchesView.module.css';

interface Props {
    defaultBranch: string;
    branchVsDefault: BranchVsDefault[];
}

// Per-branch assessment against the default branch. A branch whose changed
// files don't intersect what the default branch changed since the merge-base can be
// merged and deleted cleanly — doing so shrinks the matrix and the conflict surface.
export default function DefaultAssessmentPanel({ defaultBranch, branchVsDefault }: Props) {
    const analyzable = branchVsDefault.filter((assessment) => !assessment.error);
    if (analyzable.length === 0) return null;
    const clean = analyzable.filter((assessment) => assessment.intersection.length === 0);
    const overlapping = analyzable.filter((assessment) => assessment.intersection.length > 0);

    return (
        <div className={styles.assessment}>
            <strong className={styles.assessmentTitle}>Vs <code>{defaultBranch}</code></strong>
            <p className={styles.assessmentIntro}>
                Whether each branch touches files <code>{defaultBranch}</code> also changed since they diverged.
                Branches that don't are safe to merge &amp; delete — each one you clear shrinks the matrix.
            </p>

            {clean.length > 0 && (
                <div className={overlapping.length > 0 ? styles.assessGroup : undefined}>
                    <div className={styles.assessHeadOk}>
                        ✓ Clean against {defaultBranch} — safe to merge &amp; delete ({clean.length})
                    </div>
                    <ul className={styles.assessList}>
                        {clean.map((assessment) => <li key={assessment.branch}><code>{assessment.branch}</code></li>)}
                    </ul>
                </div>
            )}

            {overlapping.length > 0 && (
                <div>
                    <div className={styles.assessHeadWarn}>
                        ⚠ Overlap with {defaultBranch} — rebase/review before merging ({overlapping.length})
                    </div>
                    <ul className={styles.assessList}>
                        {overlapping.map((assessment) => (
                            <li key={assessment.branch} className={styles.assessItem}>
                                <code>{assessment.branch}</code>{' '}
                                <span className={styles.subtle}>
                                    — {assessment.intersection.length} file{assessment.intersection.length === 1 ? '' : 's'} also changed on {defaultBranch}:
                                </span>
                                <ul className={styles.assessSubList}>
                                    {assessment.intersection.map((file) => <li key={file}><code>{file}</code></li>)}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
