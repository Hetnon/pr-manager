import { useContext } from 'react';
import type { BranchGroup } from '../checkLocalConflicts.js';
import type { DeleteBranchResult } from '@shared/branches.js';
import { RepoContext } from '../../../repo/RepoContext.js';
import { useDeleteBranch } from '../hooks/useDeleteBranch.js';
import styles from '../BranchesView.module.css';

interface Props {
    groups: BranchGroup[];
    refresh: (folderHandle: FileSystemDirectoryHandle) => Promise<void>;
}

// Warns when multiple local branches point at the same HEAD sha, with a button
// to delete each redundant copy (local + origin) while keeping the canonical one.
// Owns the delete action itself (useDeleteBranch).
export default function DuplicatesBanner({ groups, refresh }: Props) {
    const { folderHandle, repoOwnerAndName } = useContext(RepoContext);
    const { deletingBranch, lastDelete, deleteBranch } = useDeleteBranch(
        folderHandle, repoOwnerAndName?.owner ?? null, repoOwnerAndName?.name ?? null, refresh,
    );
    const dupes = groups.filter((group) => group.branches.length > 1);
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

function DeleteOutcomeNote({ outcome }: { outcome: DeleteBranchResult }) {
    const bits: string[] = [];
    if (outcome.local.attempted) {
        bits.push(outcome.local.ok
            ? (outcome.local.alreadyGone ? 'local ✓ (was already gone)' : 'local ✓')
            : `local ✗ (${outcome.local.error ?? 'failed'})`);
    }
    if (outcome.origin.attempted) {
        bits.push(outcome.origin.ok
            ? (outcome.origin.alreadyGone ? 'origin ✓ (was already gone)' : 'origin ✓')
            : `origin ✗ (${outcome.origin.error ?? 'failed'})`);
    }
    const allOk = (!outcome.local.attempted || outcome.local.ok) && (!outcome.origin.attempted || outcome.origin.ok);
    return (
        <div className={`${styles.outcomeNote} ${allOk ? styles.ok : styles.warn}`}>
            <code>{outcome.branch}</code>: {bits.join(' · ')}
        </div>
    );
}
