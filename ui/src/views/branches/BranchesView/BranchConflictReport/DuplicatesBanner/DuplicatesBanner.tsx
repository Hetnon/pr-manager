import { useContext } from 'react';
import type { DeleteBranchResult } from '@shared/branches.js';
import { AnalysisContext } from '../../../../AnalysisContext.js';
import { BranchReportContext } from '../BranchReportContext.js';
import { useDeleteBranch } from './useDeleteBranch/useDeleteBranch.js';
import styles from './DuplicatesBanner.module.css';

// Warns when multiple local branches point at the same HEAD sha, with a button to delete
// each redundant copy (local + origin) while keeping the canonical one.
export default function DuplicatesBanner() {
    const { rawReport } = useContext(BranchReportContext);
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { deletingBranch, lastDelete, deleteBranch } = useDeleteBranch(branchesAnalysis.refresh);
    const dupes = rawReport.branchGroups.filter((group) => group.branches.length > 1);
    if (dupes.length === 0) return null;
    const totalRedundant = dupes.reduce((total, group) => total + group.branches.length - 1, 0);
    return (
        <div className={styles.dupBanner}>
            <strong>⚠ {dupes.length} group{dupes.length === 1 ? '' : 's'} of identical branches</strong> ({totalRedundant} redundant).
            Delete the duplicates (local + origin) — the canonical one is kept:
            {lastDelete && <DeleteOutcomeNote outcome={lastDelete} />}
            <ul className={styles.dupList}>
                {dupes.map((group) => (
                    <li key={group.sha} className={styles.dupGroup}>
                        At <code>{group.sha.slice(0, 8)}</code>:
                        <ul className={styles.dupBranchList}>
                            {group.branches.map((branchName, index) => (
                                <li key={branchName} className={styles.dupBranchRow}>
                                    <code>{branchName}</code>
                                    {index === 0 ? (
                                        <span className={styles.keepTag}>keep</span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => deleteBranch(branchName)}
                                            disabled={deletingBranch !== null}
                                            className={styles.smallBtn}
                                        >
                                            {deletingBranch === branchName ? 'Deleting…' : 'Delete (local + origin)'}
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function describeLeg(leg: DeleteBranchResult['local']): string | null {
    if (!leg.attempted) return null;
    if (!leg.ok) return `✗ (${leg.error ?? 'failed'})`;
    return leg.alreadyGone ? '✓ (was already gone)' : '✓';
}

function DeleteOutcomeNote({ outcome }: Readonly<{ outcome: DeleteBranchResult }>) {
    const bits: string[] = [];
    const local = describeLeg(outcome.local);
    if (local) bits.push(`local ${local}`);
    const origin = describeLeg(outcome.origin);
    if (origin) bits.push(`origin ${origin}`);
    const allOk = (!outcome.local.attempted || outcome.local.ok) && (!outcome.origin.attempted || outcome.origin.ok);
    return (
        <div className={`${styles.outcomeNote} ${allOk ? 'ok' : styles.warn}`}>
            <code>{outcome.branch}</code>: {bits.join(' · ')}
        </div>
    );
}
