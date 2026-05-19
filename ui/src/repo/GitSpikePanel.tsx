// Throwaway spike UI — shows whether isomorphic-git can read the picked folder and
// detect conflicts. Delete once Phase 1 starts.

import { useState } from 'react';
import { runGitSpike, type SpikeResult } from './gitSpike.js';

interface Props {
    handle: FileSystemDirectoryHandle | null;
}

export default function GitSpikePanel({ handle }: Props) {
    const [result, setResult] = useState<SpikeResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function run() {
        if (!handle) return;
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const perm = await (handle as FileSystemDirectoryHandle & {
                requestPermission: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
            }).requestPermission({ mode: 'read' });
            if (perm !== 'granted') {
                throw new Error(`Folder permission not granted (${perm})`);
            }
            const r = await runGitSpike(handle);
            setResult(r);
        } catch (e) {
            setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        } finally {
            setBusy(false);
        }
    }

    if (!handle) return null;

    return (
        <section style={{ border: '1px dashed #d0d7de', padding: 12, margin: '12px 0', background: '#fffbe6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Git spike</strong>
                <button type="button" onClick={() => void run()} disabled={busy}>
                    {busy ? 'Running…' : 'Run isomorphic-git probe'}
                </button>
                <span style={{ fontSize: 12, color: '#57606a' }}>
                    Reads local branches + merge dry-run via FSAPI
                </span>
            </div>
            {error && <p style={{ color: '#cf222e', marginTop: 8 }}>{error}</p>}
            {result && (
                <div style={{ marginTop: 12, fontSize: 13 }}>
                    <p style={{ margin: '4px 0' }}>
                        <strong>Current:</strong> {result.currentBranch ?? '(none)'} {' · '}
                        <strong>Default:</strong> {result.defaultBranch ?? '(none)'} {' · '}
                        <strong>Branches:</strong> {result.branches.length}
                    </p>
                    <details>
                        <summary>Branches ({result.branches.length})</summary>
                        <ul style={{ margin: 0 }}>
                            {result.branches.map((b) => (
                                <li key={b.name}><code>{b.name}</code> → <code>{b.sha.slice(0, 12)}</code></li>
                            ))}
                        </ul>
                    </details>
                    <div style={{ marginTop: 8 }}>
                        <strong>Pack file diagnostic:</strong>
                        <ul style={{ margin: 0 }}>
                            <li>dir entries ({result.packDiag.dir.length}): {result.packDiag.dir.map((n) => <code key={n} style={{ marginRight: 4 }}>{n}</code>)}</li>
                            {result.packDiag.error && <li style={{ color: '#cf222e' }}>readdir error: {result.packDiag.error}</li>}
                            {result.packDiag.files.map((f) => (
                                <li key={f.name}>
                                    <code>{f.name}</code> —{' '}
                                    {f.error
                                        ? <span style={{ color: '#cf222e' }}>ERROR: {f.error}</span>
                                        : <span>{f.size?.toLocaleString()} bytes</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <strong>History walk (5 commits each):</strong>
                        <ul style={{ margin: 0 }}>
                            {result.historyProbe.map((h) => (
                                <li key={h.branch}>
                                    <code>{h.branch}</code> — read {h.commitsRead}/{h.depthRequested}
                                    {h.firstSha && <> · HEAD <code>{h.firstSha.slice(0, 12)}</code></>}
                                    {h.oldestSha && h.commitsRead > 1 && <> → <code>{h.oldestSha.slice(0, 12)}</code></>}
                                    {h.error && <span style={{ color: '#cf222e' }}> · ERROR: {h.error}</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                    {result.treeDiffProbe && (
                        <div style={{ marginTop: 8 }}>
                            <strong>Tree diff probe:</strong> <code>{result.treeDiffProbe.theirs}</code> vs <code>{result.treeDiffProbe.ours}</code>
                            <ul style={{ margin: 0 }}>
                                <li>merge-base: <code>{result.treeDiffProbe.mergeBase?.slice(0, 12) ?? '(none)'}</code></li>
                                <li>files changed in {result.treeDiffProbe.ours}: {result.treeDiffProbe.filesChangedInOurs}</li>
                                <li>files changed in {result.treeDiffProbe.theirs}: {result.treeDiffProbe.filesChangedInTheirs}</li>
                                <li>intersection ({result.treeDiffProbe.intersectingFiles.length}{result.treeDiffProbe.intersectingFiles.length === 20 ? '+' : ''}):
                                    {result.treeDiffProbe.intersectingFiles.length === 0
                                        ? ' (none)'
                                        : <> {result.treeDiffProbe.intersectingFiles.map((f) => <code key={f} style={{ marginRight: 4 }}>{f}</code>)}</>}
                                </li>
                                {result.treeDiffProbe.error && <li style={{ color: '#cf222e' }}>error: {result.treeDiffProbe.error}</li>}
                                <li style={{ color: '#57606a' }}>{result.treeDiffProbe.notes}</li>
                            </ul>
                        </div>
                    )}
                    {result.mergeProbe && (
                        <div style={{ marginTop: 8 }}>
                            <strong>Merge probe (high-level, expected to throw on real merges):</strong> <code>{result.mergeProbe.theirs}</code> into <code>{result.mergeProbe.ours}</code>
                            <ul style={{ margin: 0 }}>
                                <li>merge-base: <code>{result.mergeProbe.mergeBase?.slice(0, 12) ?? '(none)'}</code></li>
                                <li>would conflict: <strong>{String(result.mergeProbe.wouldConflict)}</strong></li>
                                {result.mergeProbe.conflictedFiles.length > 0 && (
                                    <li>conflicted files: {result.mergeProbe.conflictedFiles.map((f) => <code key={f} style={{ marginRight: 4 }}>{f}</code>)}</li>
                                )}
                                <li style={{ color: '#57606a' }}>{result.mergeProbe.notes}</li>
                            </ul>
                        </div>
                    )}
                    <details style={{ marginTop: 8 }}>
                        <summary>Timings (ms)</summary>
                        <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(result.timings, null, 2)}</pre>
                    </details>
                </div>
            )}
        </section>
    );
}
