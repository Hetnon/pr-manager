import { useContext, useState } from 'react';
import { AnalysisContext } from '../../../../../AnalysisContext.js';
import Modal from '../../../../../ProgressModal/Modal.js';
import styles from './WorkingTreeBanner.module.css';

// Surfaces working-tree state on refresh: branch ops (fold/dedup/merge) move
// refs but never touch these files, so a dirty tree is worth flagging up front.
// A dirty tree is a clickable summary; the file breakdown opens in a modal.
export default function WorkingTreeBanner() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { worktree, worktreeBusy, worktreeError, snapshot } = branchesAnalysis;
    const currentBranch = snapshot?.currentBranch ?? null;
    const [modalOpen, setModalOpen] = useState(false);
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
        <>
            <button
                type="button"
                className={styles.warnBanner}
                onClick={() => setModalOpen(true)}
                title="Click for details"
            >
                ⚠ Working tree not clean — {parts.join(', ')}
            </button>
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={<>Working tree changes{currentBranch && <> on <code>{currentBranch}</code></>}</>}
            >
                <p className="subtle">
                    Branch operations here move refs but don't touch these files — commit or stash before merging/folding.
                </p>
                <div className={styles.wtFiles}>
                    {groups.filter(([, files]) => files.length > 0).map(([label, files]) => (
                        <div key={label} className={styles.wtGroup}>
                            <span className="subtle">{label}:</span>
                            <ul className={styles.fileUl}>
                                {files.map((file) => <li key={file}>{file}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            </Modal>
        </>
    );
}
