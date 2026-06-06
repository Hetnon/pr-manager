import { useEffect, useRef } from 'react';
import type { ConflictProgress } from '../checkLocalConflicts.js';

interface Props {
    progress: ConflictProgress | null;
    processedFiles: string[];
    defaultBranchName: string;
}

// Live progress shown inside the "Analyzing local conflicts" modal: the current
// phase, a progress bar, and (during the line-level merge) the running list of
// processed files.
export default function ConflictProgressView({ progress, processedFiles, defaultBranchName }: Props) {
    if (!progress) return <p>Starting…</p>;
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
    const step = stepLabel[progress.phase];
    const pct = ('total' in progress && progress.total > 0)
        ? Math.round((progress.current / progress.total) * 100)
        : null;
    return (
        <div style={{ fontSize: 13, fontFamily: 'inherit' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{step}</p>
            {pct !== null && 'current' in progress && 'total' in progress && (
                <>
                    <div style={{ height: 6, background: '#eaeef2', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#0969da', transition: 'width 0.15s linear' }} />
                    </div>
                    <p style={{ margin: '0 0 4px', color: '#57606a', fontSize: 12 }}>
                        {progress.current} / {progress.total}
                    </p>
                </>
            )}
            {progress.phase === 'worktree' && (
                <p style={{ margin: 0, color: '#57606a', fontSize: 12 }}>
                    {progress.scanned} file(s) scanned · <span style={{ fontFamily: 'monospace' }}>{progress.file}</span>
                </p>
            )}
            {progress.phase === 'pairwise' && (
                <p style={{ margin: 0, color: '#57606a', fontSize: 12 }}>
                    {progress.multiTouchFiles} file(s) touched by 2+ branches will be checked
                </p>
            )}
            {progress.phase === 'resolving' && (
                <p style={{ margin: 0, color: '#57606a', fontSize: 12, fontFamily: 'monospace' }}>{progress.branch}</p>
            )}
            {progress.phase === 'branch-changes' && (
                <p style={{ margin: 0, color: '#57606a', fontSize: 12, fontFamily: 'monospace' }}>{progress.branch}</p>
            )}
            {progress.phase === 'default-diff' && (
                <p style={{ margin: 0, color: '#57606a', fontSize: 12, fontFamily: 'monospace' }}>base: {progress.base.slice(0, 8)}</p>
            )}
            {progress.phase === 'line-level' && (
                <ProcessedFilesList files={processedFiles} />
            )}
            {progress.phase === 'done' && (
                <p style={{ margin: 0, color: '#1a7f37' }}>✓ Finished in {progress.elapsedMs}ms</p>
            )}
        </div>
    );
}

function ProcessedFilesList({ files }: { files: string[] }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [files]);
    return (
        <div
            ref={ref}
            style={{
                maxHeight: 240,
                overflowY: 'auto',
                border: '1px solid #d0d7de',
                borderRadius: 4,
                padding: '6px 8px',
                background: '#f6f8fa',
                fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
                fontSize: 11,
                lineHeight: 1.6,
                marginTop: 6,
            }}
        >
            {files.length === 0
                ? <div style={{ color: '#8c959f', fontStyle: 'italic' }}>(no files processed yet)</div>
                : files.map((file, index) => (
                    <div key={index} style={{ color: '#24292f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file}>
                        <span style={{ color: '#1a7f37', marginRight: 4 }}>✓</span>{file}
                    </div>
                ))}
        </div>
    );
}
