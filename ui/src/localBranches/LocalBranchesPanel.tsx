import { useEffect, useRef, useState } from 'react';
import type { PR } from '@shared/pr.js';
import { readLocalRepo, type LocalBranch, type LocalRepoSnapshot } from './readLocalRepo.js';
import { checkLocalConflicts, type BranchGroup, type ConflictProgress, type LocalConflictReport } from './checkLocalConflicts.js';
import { loadCachedReport, saveCachedReport } from './conflictCache.js';
import Modal from '../ui/Modal.js';
import { pushBranch } from './pushBranch.js';
import { fetchOrigin, type FetchResult } from './fetchOrigin.js';
import { createPr } from '../api/git.js';
import { queryFolderPermission, requestFolderReadWrite } from '../repo/folderPermission.js';
import { deleteBranchEverywhere } from '../repo/branchDeletion.js';
import type { DeleteBranchResult } from '@shared/branches.js';
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
    const [conflictProgress, setConflictProgress] = useState<ConflictProgress | null>(null);
    const [processedFiles, setProcessedFiles] = useState<string[]>([]);
    const [progressModalOpen, setProgressModalOpen] = useState(false);
    const [cacheHit, setCacheHit] = useState<{ savedAt: string } | null>(null);
    const [pushingBranch, setPushingBranch] = useState<string | null>(null);
    const [lastPush, setLastPush] = useState<PushOutcome | null>(null);
    const [fetching, setFetching] = useState(false);
    const [lastFetch, setLastFetch] = useState<FetchResult | null>(null);
    const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
    const [lastDelete, setLastDelete] = useState<DeleteBranchResult | null>(null);

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
    //
    // Note: we DON'T reread after a successful fetch. fetch only updates
    // refs/remotes/origin/*; readLocalRepo only reads refs/heads/* — local
    // branches and their SHAs are unchanged by fetch. Skipping the post-fetch
    // reread avoids a visible flash where the matrix unmounts (load clears
    // conflictReport) then re-mounts on cache hit.
    async function runRefresh(h: FileSystemDirectoryHandle) {
        await load(h);
        if (!owner || !repo) return;
        const level = await queryFolderPermission(h);
        if (level !== 'readwrite') {
            setLastFetch(null);
            return;
        }
        let result: FetchResult;
        setFetching(true);
        try {
            result = await fetchOrigin(h, owner, repo);
        } finally {
            setFetching(false);
        }
        setLastFetch(result);
    }

    // Called from button clicks — user gesture is present so requestPermission
    // can actually prompt. Returns true if we now have readwrite.
    async function ensureWritePermission(h: FileSystemDirectoryHandle): Promise<boolean> {
        const level = await queryFolderPermission(h);
        if (level === 'readwrite') return true;
        const next = await requestFolderReadWrite(h);
        return next === 'readwrite';
    }

    async function handleDeleteDuplicate(branchName: string) {
        if (!handle) return;
        if (!window.confirm(`Delete branch ${branchName} locally and on origin? This is destructive.`)) return;
        setDeletingBranch(branchName);
        setLastDelete(null);
        try {
            const ok = await ensureWritePermission(handle);
            if (!ok) {
                setLastDelete({
                    branch: branchName,
                    local: { attempted: true, ok: false, error: 'Write permission denied' },
                    origin: { attempted: false, ok: false },
                });
                return;
            }
            const result = await deleteBranchEverywhere(handle, owner, repo, branchName, 'both');
            setLastDelete(result);
            if (result.local.ok || result.origin.ok) {
                await runRefresh(handle);
            }
        } finally {
            setDeletingBranch(null);
        }
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

    // Auto-run conflict analysis whenever a fresh snapshot lands. Same pattern
    // as MasterCheck does for PR-vs-master conflict checks — no explicit button.
    useEffect(() => {
        if (!handle || !snapshot?.defaultBranch || snapshot.branches.length < 2) {
            setConflictReport(null);
            setConflictError(null);
            setConflictProgress(null);
            setProcessedFiles([]);
            setProgressModalOpen(false);
            setCacheHit(null);
            return;
        }
        const defaultBranch = snapshot.defaultBranch;
        const others = snapshot.branches.map((b) => b.name).filter((n) => n !== defaultBranch);
        let cancelled = false;
        (async () => {
            setConflictBusy(true);
            setConflictError(null);
            setConflictReport(null);
            setCacheHit(null);

            // Cache check first — skip the heavy analysis entirely if every
            // branch SHA matches the last saved run.
            const cached = await loadCachedReport(handle, snapshot);
            if (cancelled) return;
            if (cached) {
                setConflictReport(cached.report);
                setCacheHit({ savedAt: cached.savedAt });
                setConflictBusy(false);
                return;
            }

            setProcessedFiles([]);
            setConflictProgress({ phase: 'init' });
            setProgressModalOpen(true);
            try {
                const report = await checkLocalConflicts(handle, defaultBranch, others, (event) => {
                    if (cancelled) return;
                    setConflictProgress(event);
                    if (event.phase === 'line-level') {
                        setProcessedFiles((prev) => [...prev, event.file]);
                    }
                });
                if (!cancelled) {
                    setConflictReport(report);
                    setProgressModalOpen(false);
                    // Save async — don't block UI on cache write.
                    void saveCachedReport(handle, snapshot, report);
                }
            } catch (e) {
                if (!cancelled) {
                    setConflictError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
                    setProgressModalOpen(false);
                }
            } finally {
                if (!cancelled) setConflictBusy(false);
            }
        })();
        return () => { cancelled = true; };
    }, [snapshot, handle]);

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
                {(busy || fetching || conflictBusy) && (
                    <span style={{ fontSize: 12, color: '#57606a', fontStyle: 'italic' }}>
                        {fetching ? 'Fetching origin…' : conflictBusy ? 'Analyzing conflicts…' : 'Reading…'}
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
                        {cacheHit
                            ? <>📦 Loaded from cache (saved {new Date(cacheHit.savedAt).toLocaleString()}) · line-level overlap (red = same lines, yellow = same file diff lines)</>
                            : <>Analyzed in {conflictReport.elapsedMs}ms · line-level overlap (red = same lines, yellow = same file diff lines)</>}
                    </div>
                    <DuplicatesBanner
                        groups={conflictReport.branchGroups}
                        onDelete={handleDeleteDuplicate}
                        deletingBranch={deletingBranch}
                        lastDelete={lastDelete}
                    />
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
            <Modal
                open={progressModalOpen}
                onClose={() => setProgressModalOpen(false)}
                title="Analyzing local conflicts"
                maxWidth="sm"
                disableBackdropClose
            >
                <ConflictProgressView progress={conflictProgress} processedFiles={processedFiles} />
            </Modal>
        </section>
    );
}

function ConflictProgressView({ progress, processedFiles }: { progress: ConflictProgress | null; processedFiles: string[] }) {
    if (!progress) return <p>Starting…</p>;
    const stepLabel: Record<ConflictProgress['phase'], string> = {
        'init': 'Initializing',
        'resolving': 'Resolving branch HEADs',
        'branch-changes': 'Computing changes vs default',
        'default-diff': "Computing default branch's changes since base",
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
                : files.map((f, i) => (
                    <div key={i} style={{ color: '#24292f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f}>
                        <span style={{ color: '#1a7f37', marginRight: 4 }}>✓</span>{f}
                    </div>
                ))}
        </div>
    );
}

function formatCount(n: number, truncated: boolean): string {
    if (truncated) return `${n}+`;
    return String(n);
}

interface DuplicatesBannerProps {
    groups: BranchGroup[];
    onDelete: (branch: string) => void;
    deletingBranch: string | null;
    lastDelete: DeleteBranchResult | null;
}

function DuplicatesBanner({ groups, onDelete, deletingBranch, lastDelete }: DuplicatesBannerProps) {
    const dupes = groups.filter((g) => g.branches.length > 1);
    if (dupes.length === 0) return null;
    const totalRedundant = dupes.reduce((n, g) => n + g.branches.length - 1, 0);
    return (
        <div style={{ marginBottom: 8, padding: '8px 12px', background: '#fff8c5', border: '1px solid #d4a72c', borderRadius: 4, fontSize: 13 }}>
            <strong>⚠ {dupes.length} group{dupes.length === 1 ? '' : 's'} of identical branches</strong> ({totalRedundant} redundant).
            Delete the duplicates (local + origin) — the canonical one is kept:
            {lastDelete && <DeleteOutcomeNote outcome={lastDelete} />}
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                {dupes.map((g) => (
                    <li key={g.sha} style={{ marginBottom: 4 }}>
                        At <code>{g.sha.slice(0, 8)}</code>:
                        <ul style={{ margin: '2px 0 0 0', paddingLeft: 18, listStyle: 'none' }}>
                            {g.branches.map((b, i) => (
                                <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                                    <code>{b}</code>
                                    {i === 0 ? (
                                        <span style={{ fontSize: 11, color: '#1a7f37', fontWeight: 600 }}>keep</span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onDelete(b)}
                                            disabled={deletingBranch !== null}
                                            style={{ fontSize: 11, padding: '1px 6px' }}
                                        >
                                            {deletingBranch === b ? 'Deleting…' : 'Delete (local + origin)'}
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
        <div style={{ marginTop: 6, fontSize: 12, color: allOk ? '#1a7f37' : '#9a6700' }}>
            <code>{outcome.branch}</code>: {bits.join(' · ')}
        </div>
    );
}


const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 };
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '6px 8px' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' };
