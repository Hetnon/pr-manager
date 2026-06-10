import { useContext, useEffect, useRef } from 'react';
import type { ConflictProgress } from '../branches/checkLocalConflicts.js';
import { AnalysisContext } from '../AnalysisContext.js';
import styles from './ProgressModal.module.css';

// Live progress of the local-branch conflict analysis: current phase, a progress bar,
// and (during the line-level merge) the running list of processed files.
export default function BranchesProgressView() {
    const { branchesAnalysis } = useContext(AnalysisContext);
    const { conflictProgress, processedFiles, snapshot } = branchesAnalysis;
    const defaultBranchName = snapshot?.defaultBranch ?? 'default';
    if (!conflictProgress) return <p>Starting…</p>;
    
    const stepLabel: Record<ConflictProgress['phase'], string> = {
        'init': 'Initializing',
        'worktree': 'Scanning working tree',
        'resolving': 'Resolving branch HEADs',
        'branch-changes': `Listing files each branch changed since it branched off ${defaultBranchName}`,
        'default-diff': `Listing files ${defaultBranchName} changed since each branch's merge-base`,
        'pairwise': 'Cross-referencing touched files',
        'line-level': 'Running 3-way merge per shared file',
        'done': 'Done',
    };

    const step = stepLabel[conflictProgress.phase];
    const pct = ('total' in conflictProgress && conflictProgress.total > 0)
        ? Math.round((conflictProgress.current / conflictProgress.total) * 100)
        : null;
    return (
        <div className={styles.progress}>
            <p className={styles.step}>{step}</p>
            {pct !== null && 'current' in conflictProgress && 'total' in conflictProgress && (
                <>
                    <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                    </div>
                    <p className={styles.detail}>
                        {conflictProgress.current} / {conflictProgress.total}
                    </p>
                </>
            )}
            {conflictProgress.phase === 'worktree' && (
                <p className={styles.detail}>
                    {conflictProgress.scanned} file(s) scanned · <span className={styles.mono}>{conflictProgress.file}</span>
                </p>
            )}
            {conflictProgress.phase === 'pairwise' && (
                <p className={styles.detail}>
                    {conflictProgress.multiTouchFiles} file(s) touched by 2+ branches will be checked
                </p>
            )}
            {conflictProgress.phase === 'resolving' && (
                <p className={`${styles.detail} ${styles.mono}`}>{conflictProgress.branch}</p>
            )}
            {conflictProgress.phase === 'branch-changes' && (
                <p className={`${styles.detail} ${styles.mono}`}>{conflictProgress.branch}</p>
            )}
            {conflictProgress.phase === 'default-diff' && (
                <p className={`${styles.detail} ${styles.mono}`}>base: {conflictProgress.base.slice(0, 8)}</p>
            )}
            {conflictProgress.phase === 'line-level' && (
                <ProcessedFilesList files={processedFiles} />
            )}
            {conflictProgress.phase === 'done' && (
                <p className={styles.done}>✓ Finished in {conflictProgress.elapsedMs}ms</p>
            )}
        </div>
    );
}

function ProcessedFilesList({ files }: Readonly<{ files: string[] }>) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [files]);
    return (
        <div ref={ref} className={styles.fileList}>
            {files.length === 0
                ? <div className={styles.fileListEmpty}>(no files processed yet)</div>
                : files.map(file => (
                    <div key={file} className={styles.fileRow} title={file}>
                        <span className={styles.fileCheck}>✓</span>{file}
                    </div>
                ))}
        </div>
    );
}
