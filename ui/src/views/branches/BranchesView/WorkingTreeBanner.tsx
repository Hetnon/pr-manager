import { useContext, useState } from 'react';
import { AnalysisContext } from '../../AnalysisContext.js';
import styles from './BranchesView.module.css';

// Surfaces working-tree state on refresh: branch ops (fold/dedup/merge) move
// refs but never touch these files, so a dirty tree is worth flagging up front.
export default function WorkingTreeBanner() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { worktree, worktreeBusy, worktreeError, snapshot } = branchesAnalysis;
    const currentBranch = snapshot?.currentBranch ?? null;
    const [open, setOpen] = useState(false);
    if (worktreeBusy && !worktree) {
        return <p className={styles.wtChecking}>Checking working tree…</p>;
    }
    if (worktreeError) {
        return (
            <p className={styles.wtError}>
                ⚠ Couldn't read working-tree status: {worktreeError}
            </p>
        );
    }
    if (!worktree) return null;
    if (worktree.clean) {
        return <p className={styles.wtClean}>✓ Working tree clean</p>;
    }

    const parts: string[] = [];
    if (worktree.untracked.length) parts.push(`${worktree.untracked.length} untracked`);
    if (worktree.modified.length) parts.push(`${worktree.modified.length} modified`);
    if (worktree.deleted.length) parts.push(`${worktree.deleted.length} deleted`);
    const groups: Array<[string, string[]]> = [
        ['Untracked', worktree.untracked],
        ['Modified', worktree.modified],
        ['Deleted', worktree.deleted],
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
