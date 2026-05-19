import { useEffect, useState } from 'react';
import type { PR } from '@shared/pr.js';
import { readLocalRepo, type LocalBranch, type LocalRepoSnapshot } from './readLocalRepo.js';
import { checkLocalConflicts, type BranchGroup, type LocalConflictReport } from './checkLocalConflicts.js';
import { pushBranch } from './pushBranch.js';
import { fetchOrigin, type FetchResult } from './fetchOrigin.js';
import { createPr } from '../api/git.js';
import { queryFolderPermission, requestFolderReadWrite } from '../repo/folderPermission.js';
import LocalBranchesMatrix from './LocalBranchesMatrix.js';

interface Props {
    handle: FileSystemDirectoryHandle | null;
    prs: PR[] | null;
    owner: string | null;
    repo: string | null;
    // Incremented by the parent when the user clicks Refresh (or after a
    // permission upgrade). Triggers a reread + opportunistic fetch.
    refreshNonce: number;
    onPushed?: () => void;
}

type PushOutcome =
    | { ok: true; branch: string; prNumber: number; prUrl: string }
    | { ok: false; branch: string; message: string };

interface Row {
    branch: LocalBranch;
    pr: PR | null;
}

export default function LocalBranchesPanel({ handle, prs, owner, repo, refreshNonce, onPushed }: Props) {
    const [snapshot, setSnapshot] = useState<LocalRepoSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [conflictReport, setConflictReport] = useState<LocalConflictReport | null>(null);
    const [conflictError, setConflictError] = useState<string | null>(null);
    const [conflictBusy, setConflictBusy] = useState(false);
    const [pushingBranch, setPushingBranch] = useState<string | null>(null);
    const [lastPush, setLastPush] = useState<PushOutcome | null>(null);
    const [fetching, setFetching] = useState(false);
    const [lastFetch, setLastFetch] = useState<FetchResult | null>(null);

    useEffect(() => {
        if (!handle) {
            setSnapshot(null);
            setError(null);
            setConflictReport(null);
            setConflictError(null);
            return;
        }
        void runRefresh(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handle, refreshNonce]);

    async function load(h: FileSystemDirectoryHandle) {
        setBusy(true);
        setError(null);
        setConflictReport(null);
        setConflictError(null);
        try {
            // Query-only: requestPermission throws SecurityError when called
            // outside a user gesture (this runs from useEffect). The header
            // badge is the gesture-enabled path to upgrade.
            const level = await queryFolderPermission(h);
            if (level === 'none') {
                throw new Error('Folder access not granted — click the badge in the header to grant.');
            }
            const snap = await readLocalRepo(h);
            setSnapshot(snap);
        } catch (e) {
            setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        } finally {
            setBusy(false);
        }
    }

    // Unified refresh — reread local state, and if readwrite is granted, do an
    // opportunistic fetch + prune. No permission prompts here; the badge is
    // the gesture-enabled path for upgrades.
    async function runRefresh(h: FileSystemDirectoryHandle) {
        await load(h);
        if (!owner || !repo) return;
        const level = await queryFolderPermission(h);
        if (level !== 'readwrite') {
            setLastFetch(null);
            return;
        }
        setFetching(true);
        try {
            const result = await fetchOrigin(h, owner, repo);
            setLastFetch(result);
            if (result.ok) await load(h);
        } finally {
            setFetching(false);
        }
    }

    // Called from button clicks — user gesture is present so requestPermission
    // can actually prompt. Returns true if we now have readwrite.
    async function ensureWritePermission(h: FileSystemDirectoryHandle): Promise<boolean> {
        const level = await queryFolderPermission(h);
        if (level === 'readwrite') return true;
        const next = await requestFolderReadWrite(h);
        return next === 'readwrite';
    }

    async function handlePush(branch: LocalBranch) {
        if (!handle || !owner || !repo || !snapshot?.defaultBranch) return;
        const defaultTitle = branch.head?.message ?? branch.name;
        const title = window.prompt(`PR title for ${branch.name} → ${snapshot.defaultBranch}?`, defaultTitle);
        if (title === null) return; // cancelled
        setPushingBranch(branch.name);
        setLastPush(null);
        try {
            const ok = await ensureWritePermission(handle);
            if (!ok) {
                setLastPush({ ok: false, branch: branch.name, message: 'Write permission denied — push needs to update local refs.' });
                return;
            }
            const pushResult = await pushBranch(handle, branch.name, owner, repo);
            if (!pushResult.ok) {
                setLastPush({ ok: false, branch: branch.name, message: `Push failed: ${pushResult.error}` });
                return;
            }
            try {
                const pr = await createPr({
                    owner, repo,
                    head: branch.name,
                    base: snapshot.defaultBranch,
                    title,
                });
                setLastPush({ ok: true, branch: branch.name, prNumber: pr.number, prUrl: pr.url });
                onPushed?.();
            } catch (e) {
                // Push succeeded but PR creation failed — surface both facts.
                const msg = e instanceof Error ? e.message : String(e);
                setLastPush({ ok: false, branch: branch.name, message: `Push OK, but PR create failed: ${msg}` });
            }
        } finally {
            setPushingBranch(null);
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
                <button
                    type="button"
                    onClick={() => void runConflicts()}
                    disabled={conflictBusy || !snapshot || snapshot.branches.length < 2}
                >
                    {conflictBusy ? 'Analyzing…' : 'Check conflicts'}
                </button>
                {(busy || fetching) && (
                    <span style={{ fontSize: 12, color: '#57606a', fontStyle: 'italic' }}>
                        {fetching ? 'Fetching origin…' : 'Reading…'}
                    </span>
                )}
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
            {lastFetch && (
                <p style={{ marginTop: 8, color: lastFetch.ok ? '#1a7f37' : '#cf222e' }}>
                    {lastFetch.ok
                        ? <>✓ Fetched at {new Date(lastFetch.fetchedAt).toLocaleTimeString()}{lastFetch.prunedRefs > 0 ? ` · pruned ${lastFetch.prunedRefs} stale ref(s)` : ''}</>
                        : <>✗ Fetch failed: {lastFetch.error}</>}
                </p>
            )}
            {lastPush && (
                <p style={{ marginTop: 8, color: lastPush.ok ? '#1a7f37' : '#cf222e' }}>
                    {lastPush.ok
                        ? <>✓ Pushed <code>{lastPush.branch}</code> and opened <a href={lastPush.prUrl} target="_blank" rel="noreferrer">PR #{lastPush.prNumber}</a></>
                        : <>✗ <code>{lastPush.branch}</code>: {lastPush.message}</>}
                </p>
            )}
            {conflictReport && snapshot && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: '#57606a', marginBottom: 6 }}>
                        Analyzed in {conflictReport.elapsedMs}ms · line-level overlap (red = same lines, yellow = same file diff lines)
                    </div>
                    <DuplicatesBanner groups={conflictReport.branchGroups} />
                    <LocalBranchesMatrix
                        defaultBranch={conflictReport.defaultBranch}
                        branches={snapshot.branches}
                        branchChanges={conflictReport.branchChanges}
                        branchGroups={conflictReport.branchGroups}
                        fileSeverity={conflictReport.fileSeverity}
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
                            <th style={th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ branch, pr }) => {
                            const isDefault = branch.name === snapshot.defaultBranch;
                            const canPush = !isDefault && !pr && branch.aheadOfDefault > 0 && !!owner && !!repo;
                            return (
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
                                        {isDefault ? '—' : formatCount(branch.aheadOfDefault, branch.truncated)}
                                    </td>
                                    <td style={tdNum}>
                                        {isDefault ? '—' : formatCount(branch.behindDefault, branch.truncated)}
                                    </td>
                                    <td style={td}>
                                        {branch.error
                                            ? <span style={{ color: '#cf222e' }}>{branch.error}</span>
                                            : branch.head
                                                ? <span title={`${branch.head.authorName} · ${new Date(branch.head.date).toLocaleString()}`}>{branch.head.message}</span>
                                                : '—'}
                                    </td>
                                    <td style={td}>
                                        {canPush && (
                                            <button
                                                type="button"
                                                onClick={() => void handlePush(branch)}
                                                disabled={pushingBranch !== null}
                                            >
                                                {pushingBranch === branch.name ? 'Pushing…' : 'Push & open PR'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
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

function DuplicatesBanner({ groups }: { groups: BranchGroup[] }) {
    const dupes = groups.filter((g) => g.branches.length > 1);
    if (dupes.length === 0) return null;
    const totalRedundant = dupes.reduce((n, g) => n + g.branches.length - 1, 0);
    return (
        <div style={{ marginBottom: 8, padding: '8px 12px', background: '#fff8c5', border: '1px solid #d4a72c', borderRadius: 4, fontSize: 13 }}>
            <strong>⚠ {dupes.length} group{dupes.length === 1 ? '' : 's'} of identical branches</strong> ({totalRedundant} redundant). Consider deleting the duplicates:
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                {dupes.map((g) => (
                    <li key={g.sha} style={{ marginBottom: 2 }}>
                        At <code>{g.sha.slice(0, 8)}</code>: {g.branches.map((b, i) => (
                            <span key={b}>
                                <code>{b}</code>{i === 0 ? ' (keep)' : ''}
                                {i < g.branches.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </li>
                ))}
            </ul>
        </div>
    );
}


const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 };
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '6px 8px' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' };
