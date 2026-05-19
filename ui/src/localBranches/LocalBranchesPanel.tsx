import { useEffect, useState } from 'react';
import type { PR } from '@shared/pr.js';
import { readLocalRepo, type LocalBranch, type LocalRepoSnapshot } from './readLocalRepo.js';
import { checkLocalConflicts, type LocalConflictReport } from './checkLocalConflicts.js';
import LocalBranchesMatrix from './LocalBranchesMatrix.js';

interface Props {
    handle: FileSystemDirectoryHandle | null;
    prs: PR[] | null;
}

interface Row {
    branch: LocalBranch;
    pr: PR | null;
}

export default function LocalBranchesPanel({ handle, prs }: Props) {
    const [snapshot, setSnapshot] = useState<LocalRepoSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [conflictReport, setConflictReport] = useState<LocalConflictReport | null>(null);
    const [conflictError, setConflictError] = useState<string | null>(null);
    const [conflictBusy, setConflictBusy] = useState(false);

    useEffect(() => {
        if (!handle) {
            setSnapshot(null);
            setError(null);
            setConflictReport(null);
            setConflictError(null);
            return;
        }
        void load(handle);
    }, [handle]);

    async function load(h: FileSystemDirectoryHandle) {
        setBusy(true);
        setError(null);
        setConflictReport(null);
        setConflictError(null);
        try {
            const perm = await ensureReadPermission(h);
            if (perm !== 'granted') {
                throw new Error(`Folder permission not granted (${perm})`);
            }
            const snap = await readLocalRepo(h);
            setSnapshot(snap);
        } catch (e) {
            setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function runConflicts() {
        if (!handle || !snapshot?.defaultBranch) return;
        setConflictBusy(true);
        setConflictError(null);
        setConflictReport(null);
        try {
            const others = snapshot.branches.map((b) => b.name).filter((n) => n !== snapshot.defaultBranch);
            const report = await checkLocalConflicts(handle, snapshot.defaultBranch, others);
            setConflictReport(report);
        } catch (e) {
            setConflictError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        } finally {
            setConflictBusy(false);
        }
    }

    if (!handle) return null;

    const prByRef = new Map<string, PR>();
    for (const pr of prs ?? []) prByRef.set(pr.headRefName, pr);

    const rows: Row[] = (snapshot?.branches ?? []).map((branch) => ({
        branch,
        pr: prByRef.get(branch.name) ?? null,
    }));

    return (
        <section style={{ border: '1px solid #d0d7de', padding: 12, margin: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Local branches</strong>
                <button type="button" onClick={() => handle && void load(handle)} disabled={busy}>
                    {busy ? 'Reading…' : '↻ Reread'}
                </button>
                <button
                    type="button"
                    onClick={() => void runConflicts()}
                    disabled={conflictBusy || !snapshot || snapshot.branches.length < 2}
                >
                    {conflictBusy ? 'Analyzing…' : 'Check conflicts'}
                </button>
                {snapshot && (
                    <span style={{ fontSize: 12, color: '#57606a' }}>
                        default <code>{snapshot.defaultBranch ?? '(none)'}</code> ·
                        current <code>{snapshot.currentBranch ?? '(detached)'}</code> ·
                        {snapshot.branches.length} branch{snapshot.branches.length === 1 ? '' : 'es'} ·
                        read in {snapshot.readMs}ms
                    </span>
                )}
            </div>
            {error && <p style={{ color: '#cf222e', marginTop: 8 }}>{error}</p>}
            {conflictError && <p style={{ color: '#cf222e', marginTop: 8 }}>{conflictError}</p>}
            {conflictReport && snapshot && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: '#57606a', marginBottom: 6 }}>
                        Analyzed in {conflictReport.elapsedMs}ms · file-level overlap (line-level overlap TBD)
                    </div>
                    <LocalBranchesMatrix
                        defaultBranch={conflictReport.defaultBranch}
                        branches={snapshot.branches}
                        branchChanges={conflictReport.branchChanges}
                    />
                </div>
            )}
            {snapshot && rows.length > 0 && (
                <table style={{ width: '100%', marginTop: 12, fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #d0d7de' }}>
                            <th style={th}>Branch</th>
                            <th style={th}>PR</th>
                            <th style={th}>HEAD</th>
                            <th style={thNum}>Ahead</th>
                            <th style={thNum}>Behind</th>
                            <th style={th}>Last commit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ branch, pr }) => (
                            <tr key={branch.name} style={{ borderBottom: '1px solid #eaeef2' }}>
                                <td style={td}>
                                    {branch.current && <span title="current branch">● </span>}
                                    <code>{branch.name}</code>
                                </td>
                                <td style={td}>
                                    {pr
                                        ? <a href={pr.url} target="_blank" rel="noreferrer">#{pr.number}</a>
                                        : <span style={{ color: '#8c959f' }}>—</span>}
                                </td>
                                <td style={td}><code>{branch.sha.slice(0, 8)}</code></td>
                                <td style={tdNum}>
                                    {branch.name === snapshot.defaultBranch ? '—' : formatCount(branch.aheadOfDefault, branch.truncated)}
                                </td>
                                <td style={tdNum}>
                                    {branch.name === snapshot.defaultBranch ? '—' : formatCount(branch.behindDefault, branch.truncated)}
                                </td>
                                <td style={td}>
                                    {branch.error
                                        ? <span style={{ color: '#cf222e' }}>{branch.error}</span>
                                        : branch.head
                                            ? <span title={`${branch.head.authorName} · ${new Date(branch.head.date).toLocaleString()}`}>{branch.head.message}</span>
                                            : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

function formatCount(n: number, truncated: boolean): string {
    if (truncated) return `${n}+`;
    return String(n);
}


async function ensureReadPermission(h: FileSystemDirectoryHandle): Promise<PermissionState> {
    const handle = h as FileSystemDirectoryHandle & {
        queryPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
        requestPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    };
    if (handle.queryPermission) {
        const existing = await handle.queryPermission({ mode: 'read' });
        if (existing === 'granted') return existing;
    }
    if (!handle.requestPermission) return 'denied';
    return await handle.requestPermission({ mode: 'read' });
}

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 };
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '6px 8px' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' };
