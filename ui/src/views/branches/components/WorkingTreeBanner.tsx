import { useState } from 'react';
import type { WorkingTreeStatus } from '../workingTreeStatus.js';
import styles from '../BranchesView.module.css';

interface Props {
    status: WorkingTreeStatus | null;
    busy: boolean;
    error: string | null;
    currentBranch: string | null;
}

// Surfaces working-tree state on refresh: branch ops (fold/dedup/merge) move
// refs but never touch these files, so a dirty tree is worth flagging up front.
export default function WorkingTreeBanner({ status, busy, error, currentBranch }: Props) {
    const [open, setOpen] = useState(false);
    if (busy && !status) {
        return <p className={styles.wtChecking}>Checking working tree…</p>;
    }
    if (error) {
        return (
            <p className={styles.wtError}>
                ⚠ Couldn't read working-tree status: {error}
            </p>
        );
    }
    if (!status) return null;
    if (status.clean) {
        return <p className={styles.wtClean}>✓ Working tree clean</p>;
    }

    const parts: string[] = [];
    if (status.untracked.length) parts.push(`${status.untracked.length} untracked`);
    if (status.modified.length) parts.push(`${status.modified.length} modified`);
    if (status.deleted.length) parts.push(`${status.deleted.length} deleted`);
    const groups: Array<[string, string[]]> = [
        ['Untracked', status.untracked],
        ['Modified', status.modified],
        ['Deleted', status.deleted],
    ];

    return (
        <div className={styles.warnBanner}>
            <strong>⚠ Working tree not clean</strong>
            {currentBranch && <> on <code>{currentBranch}</code></>} — {parts.join(', ')}.
            <span className={styles.subtle}> Branch operations here move refs but don't touch these files — commit or stash before merging/folding.</span>
            {' '}
            <button
                type="button"
                onClick={() => setOpen((isOpen) => !isOpen)}
                className={styles.linkButton}
            >
                {open ? 'hide' : 'show'} files
            </button>
            {open && (
                <div className={styles.wtFiles}>
                    {groups.filter(([, files]) => files.length > 0).map(([label, files]) => (
                        <div key={label} className={styles.wtGroup}>
                            <span className={styles.subtle}>{label}:</span>
                            <ul className={styles.fileUl}>
                                {files.map((file) => <li key={file}>{file}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
