import { useEffect, useRef, useState } from 'react';
import type { PR } from '@shared/pr.js';
import { readLocalRepo, type LocalBranch, type LocalRepoSnapshot } from './readLocalRepo.js';
import { checkLocalConflicts, type BranchGroup, type BranchVsDefault, type ConflictProgress, type LocalConflictReport } from './checkLocalConflicts.js';
import { loadCache, createCacheWriter, ensureCacheIgnored } from './conflictCache.js';
import Modal from '../resusableComponents/Modal.js';
import { pushBranch } from './pushBranch.js';
import { fetchOrigin, type FetchResult } from './fetchOrigin.js';
import { createPr } from '../api/git.js';
import { closePr } from '../api/prs.js';
import { queryFolderPermission, requestFolderReadWrite } from '../repo/folderPermission.js';
import { deleteBranchEverywhere } from '../repo/branchDeletion.js';
import type { DeleteBranchResult } from '@shared/branches.js';
import LocalBranchesMatrix from './LocalBranchesMatrix.js';
import DedupPanel from './DedupPanel.js';
import { createDedupBranch, foldDedupIntoOriginal, DEDUP_SUFFIX } from './createDedupBranch.js';
import { filesToStripByDonor, applyDedupToReport, type DedupOption } from './planDedup.js';
import { readWorkingTreeStatus, type WorkingTreeStatus } from './workingTreeStatus.js';

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
    const [pushingBranch, setPushingBranch] = useState<string | null>(null);
    const [lastPush, setLastPush] = useState<PushOutcome | null>(null);
    const [fetching, setFetching] = useState(false);
    const [lastFetch, setLastFetch] = useState<FetchResult | null>(null);
    const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
    const [lastDelete, setLastDelete] = useState<DeleteBranchResult | null>(null);
    const [dedupBusy, setDedupBusy] = useState(false);
    const [lastDedup, setLastDedup] = useState<{ ok: boolean; message: string } | null>(null);
    const [closingPr, setClosingPr] = useState<number | null>(null);
    const [lastClosePr, setLastClosePr] = useState<{ ok: boolean; message: string } | null>(null);
    const [worktree, setWorktree] = useState<WorkingTreeStatus | null>(null);
    const [worktreeBusy, setWorktreeBusy] = useState(false);
    const [worktreeError, setWorktreeError] = useState<string | null>(null);

    useEffect(() => {
        if (!handle) {
            setSnapshot(null);
            setError(null);
            setConflictReport(null);
            setConflictError(null);
            setWorktree(null);
            setWorktreeError(null);
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
        setWorktree(null);
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
            // The working-tree scan + conflict analysis run together in the effect
            // below (one progress modal), triggered by this snapshot change.
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

    // Returns a reason to block a ref-moving action when the working tree is
    // dirty, or null to proceed. Branch ops move refs but never touch the working
    // tree, so uncommitted/untracked work could silently desync. If status can't
    // be read we don't block — we can't prove it's dirty.
    async function workingTreeBlockReason(action: string): Promise<string | null> {
        if (!handle) return null;
        let status: WorkingTreeStatus;
        try {
            status = await readWorkingTreeStatus(handle);
        } catch {
            return null;
        }
        if (status.clean) return null;
        const counts = [
            status.untracked.length ? `${status.untracked.length} untracked` : '',
            status.modified.length ? `${status.modified.length} modified` : '',
            status.deleted.length ? `${status.deleted.length} deleted` : '',
        ].filter(Boolean).join(', ');
        return `Working tree isn't clean (${counts}). Commit or stash before ${action}.`;
    }

    // Create `‹donor›-dedup` branches for the approved dedup actions: each donor
    // sheds the files identical to a later branch (reverted to its merge-base).
    // Originals stay; the analysis below prefers the dedup copy once it exists.
    async function handleDedup(approved: DedupOption[]) {
        if (!handle || !conflictReport) return;
        const byDonor = filesToStripByDonor(approved);
        if (byDonor.size === 0) return;
        setDedupBusy(true);
        setLastDedup(null);
        try {
            const blockReason = await workingTreeBlockReason('creating dedup branches');
            if (blockReason) {
                setLastDedup({ ok: false, message: blockReason });
                return;
            }
            const ok = await ensureWritePermission(handle);
            if (!ok) {
                setLastDedup({ ok: false, message: 'Write permission denied — creating branches needs to write refs.' });
                return;
            }
            const bcByName = new Map(conflictReport.branchChanges.map((bc) => [bc.branch, bc]));
            const created: string[] = [];
            const errors: string[] = [];
            const appliedByDonor = new Map<string, Set<string>>();
            for (const [donor, files] of byDonor) {
                const bc = bcByName.get(donor);
                if (!bc || bc.error || !bc.base) {
                    errors.push(`${donor}: no merge-base to revert against`);
                    continue;
                }
                try {
                    const result = await createDedupBranch(handle, donor, bc.sha, bc.base, [...files]);
                    created.push(`${result.dedupBranch} (−${result.reverted + result.deleted} files)`);
                    appliedByDonor.set(donor, files);
                } catch (e) {
                    errors.push(`${donor}: ${(e as Error).message}`);
                }
            }
            const parts: string[] = [];
            if (created.length) parts.push(`Created ${created.join(', ')}`);
            if (errors.length) parts.push(`Errors: ${errors.join('; ')}`);
            setLastDedup({ ok: errors.length === 0, message: parts.join(' · ') || 'Nothing to do.' });
            // Patch the existing report in place — the analysis was already done,
            // so we just drop the deduped files from each donor. No re-analysis.
            if (appliedByDonor.size > 0) {
                setConflictReport((prev) => (prev ? applyDedupToReport(prev, appliedByDonor) : prev));
            }
        } finally {
            setDedupBusy(false);
        }
    }

    async function handlePush(branch: LocalBranch) {
        if (!handle || !owner || !repo || !snapshot?.defaultBranch) return;
        // If this is a dedup copy whose original still exists, fold it back onto
        // the original's name (fast-forward) so we push one real branch, not the
        // -dedup. The PR is opened from the original name.
        const localNames = new Set(snapshot.branches.map((b) => b.name));
        const foldOriginal = branch.name.endsWith(DEDUP_SUFFIX)
            ? branch.name.slice(0, -DEDUP_SUFFIX.length)
            : null;
        const willFold = foldOriginal !== null && localNames.has(foldOriginal);
        const pushName = willFold ? foldOriginal! : branch.name;

        // Folding moves the original branch's ref — refuse if the working tree
        // is dirty (a dirty current branch would desync from the moved ref).
        if (willFold) {
            const blockReason = await workingTreeBlockReason(`folding ${branch.name} into ${foldOriginal}`);
            if (blockReason) {
                setLastPush({ ok: false, branch: pushName, message: blockReason });
                return;
            }
        }

        const defaultTitle = branch.head?.message ?? pushName;
        const title = window.prompt(`PR title for ${pushName} → ${snapshot.defaultBranch}?`, defaultTitle);
        if (title === null) return; // cancelled
        setPushingBranch(branch.name);
        setLastPush(null);
        try {
            const ok = await ensureWritePermission(handle);
            if (!ok) {
                setLastPush({ ok: false, branch: pushName, message: 'Write permission denied — push needs to update local refs.' });
                return;
            }
            if (willFold) {
                try {
                    await foldDedupIntoOriginal(handle, branch.name, foldOriginal!);
                } catch (e) {
                    setLastPush({ ok: false, branch: pushName, message: `Couldn't fold ${branch.name} into ${foldOriginal}: ${(e as Error).message}` });
                    return;
                }
            }
            const pushResult = await pushBranch(handle, pushName, owner, repo);
            if (!pushResult.ok) {
                setLastPush({ ok: false, branch: pushName, message: `Push failed: ${pushResult.error}` });
                return;
            }
            try {
                const pr = await createPr({
                    owner, repo,
                    head: pushName,
                    base: snapshot.defaultBranch,
                    title,
                });
                setLastPush({ ok: true, branch: pushName, prNumber: pr.number, prUrl: pr.url });
                if (willFold) await runRefresh(handle); // reflect the fold (X-dedup gone, X moved)
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

    // Close a PR without merging (disregard it). GitHub has no delete-PR; closing
    // is the equivalent and is reopenable. Refetches PRs after so it drops off.
    async function handleClosePr(pr: PR) {
        if (!owner || !repo) return;
        if (!window.confirm(`Close PR #${pr.number} (${pr.title}) without merging? You can reopen it on GitHub.`)) return;
        setClosingPr(pr.number);
        setLastClosePr(null);
        try {
            const result = await closePr(owner, repo, pr.number);
            if (result.ok) {
                setLastClosePr({ ok: true, message: `Closed PR #${pr.number} (not merged).` });
                onPushed?.(); // refetch PRs so the closed one drops out of the list
            } else {
                setLastClosePr({ ok: false, message: `Couldn't close PR #${pr.number}: ${result.error}` });
            }
        } catch (e) {
            setLastClosePr({ ok: false, message: `Couldn't close PR #${pr.number}: ${(e as Error).message}` });
        } finally {
            setClosingPr(null);
        }
    }

    // Auto-run, whenever a fresh snapshot lands: first scan the working tree,
    // then (if there are 2+ analyzable branches) run conflict analysis. Both
    // report into the same progress modal — "Scanning working tree → Analyzing
    // conflicts", file by file. Same no-button pattern as MasterCheck.
    useEffect(() => {
        if (!handle || !snapshot?.defaultBranch) {
            setConflictReport(null);
            setConflictError(null);
            setConflictProgress(null);
            setProcessedFiles([]);
            setProgressModalOpen(false);
            setWorktree(null);
            setWorktreeError(null);
            return;
        }
        const defaultBranch = snapshot.defaultBranch;
        const names = new Set(snapshot.branches.map((b) => b.name));
        const others = snapshot.branches
            .map((b) => b.name)
            .filter((n) => n !== defaultBranch)
            // Once a `‹branch›-dedup` exists, analyze it instead of the original —
            // the deduplicated copy is the one you'd merge, and this is what makes
            // the redundant (blue) overlaps collapse after applying dedup.
            .filter((n) => !names.has(`${n}-dedup`));
        const handleRef = handle;
        let cancelled = false;
        // Only open the modal if the work is actually slow — cache hits / small
        // trees often complete in <300ms and the modal flash would be jarring.
        const modalDelayTimer = setTimeout(() => {
            if (!cancelled) setProgressModalOpen(true);
        }, 300);
        (async () => {
            setConflictError(null);
            setConflictReport(null);
            setProcessedFiles([]);
            setConflictProgress({ phase: 'init' });
            try {
                // Phase 1: working-tree scan (always — useful at any branch count).
                setWorktree(null);
                setWorktreeError(null);
                setWorktreeBusy(true);
                try {
                    const status = await readWorkingTreeStatus(handleRef, (event) => {
                        if (!cancelled) setConflictProgress({ phase: 'worktree', file: event.file, scanned: event.scanned });
                    });
                    if (!cancelled) setWorktree(status);
                } catch (e) {
                    if (!cancelled) setWorktreeError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
                } finally {
                    if (!cancelled) setWorktreeBusy(false);
                }
                if (cancelled) return;

                // Phase 2: conflict analysis (needs 2+ analyzable branches).
                if (others.length === 0) {
                    setConflictReport(null);
                    setConflictProgress({ phase: 'done', elapsedMs: 0 });
                    return;
                }
                setConflictBusy(true);
                try {
                    const cache = await loadCache(handleRef);
                    if (cancelled) return;
                    // Git-ignore the cache folder up front so the background writes
                    // below never leave an untracked folder visible if interrupted.
                    void ensureCacheIgnored(handleRef);
                    // Background writer: the analysis loop just signals new work and
                    // keeps computing; this serializes + coalesces the disk writes.
                    const cacheWriter = createCacheWriter(handleRef, cache);
                    const report = await checkLocalConflicts(
                        handleRef, defaultBranch, others, cache,
                        (event) => {
                            if (cancelled) return;
                            setConflictProgress(event);
                            if (event.phase === 'line-level') {
                                setProcessedFiles((prev) => [...prev, event.file]);
                            }
                        },
                        // Non-blocking — hand off to the writer. Fires even if
                        // cancelled: the computed work is still valid for this repo.
                        () => cacheWriter.schedule(),
                    );
                    // Persist the final state and let any in-flight write settle.
                    cacheWriter.schedule();
                    void cacheWriter.drain();
                    if (!cancelled) setConflictReport(report);
                } catch (e) {
                    if (!cancelled) setConflictError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
                } finally {
                    if (!cancelled) setConflictBusy(false);
                }
            } finally {
                clearTimeout(modalDelayTimer);
                if (!cancelled) setProgressModalOpen(false);
            }
        })();
        return () => { cancelled = true; clearTimeout(modalDelayTimer); };
    }, [snapshot, handle]);

    if (!handle) return null;

    const prByRef = new Map<string, PR>();
    for (const pr of prs ?? []) prByRef.set(pr.headRefName, pr);

    // Once a `‹branch›-dedup` exists it supersedes the original — show (and push)
    // only the deduped copy, so the list matches the matrix's 3 effective
    // branches instead of listing both. (Same rule as the matrix's `others`.)
    const branchNames = new Set((snapshot?.branches ?? []).map((b) => b.name));
    const rows: Row[] = (snapshot?.branches ?? [])
        .filter((branch) => !branchNames.has(`${branch.name}-dedup`))
        .map((branch) => ({
            branch,
            pr: prByRef.get(branch.name) ?? null,
        }));

    // Show the explainer note only when the asymmetry is actually on screen: the
    // current branch is dirty (its Push is blocked) AND some other branch still
    // offers Push.
    const worktreeDirty = !!worktree && !worktree.clean;
    const hasOtherPushable = rows.some(({ branch, pr }) =>
        !branch.current
        && branch.name !== snapshot?.defaultBranch
        && !pr
        && branch.aheadOfDefault > 0
        && !!owner && !!repo,
    );

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
            {lastClosePr && (
                <p style={{ marginTop: 8, color: lastClosePr.ok ? '#1a7f37' : '#cf222e' }}>
                    {lastClosePr.ok ? '✓ ' : '✗ '}{lastClosePr.message}
                </p>
            )}
            <WorkingTreeBanner status={worktree} busy={worktreeBusy} error={worktreeError} currentBranch={snapshot?.currentBranch ?? null} />
            {conflictReport && snapshot && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: '#57606a', marginBottom: 6 }}>
                        Analyzed in {conflictReport.elapsedMs}ms · {conflictReport.cacheHits} cache hits, {conflictReport.cacheMisses} computed · real 3-way merge per shared file
                    </div>
                    <DuplicatesBanner
                        groups={conflictReport.branchGroups}
                        onDelete={handleDeleteDuplicate}
                        deletingBranch={deletingBranch}
                        lastDelete={lastDelete}
                    />
                    <DedupPanel
                        branchOrder={conflictReport.branchChanges
                            .filter((bc) => !bc.error && bc.files.length > 0)
                            .map((bc) => bc.branch)
                            .sort((a, b) => a.localeCompare(b))}
                        fileDetail={conflictReport.fileDetail}
                        busy={dedupBusy}
                        onApply={handleDedup}
                    />
                    {lastDedup && (
                        <p style={{ margin: '0 0 8px', color: lastDedup.ok ? '#1a7f37' : '#cf222e', fontSize: 13 }}>
                            {lastDedup.ok ? '✓ ' : '✗ '}{lastDedup.message}
                        </p>
                    )}
                    <MatrixLegend />
                    <LocalBranchesMatrix
                        defaultBranch={conflictReport.defaultBranch}
                        branches={snapshot.branches}
                        branchChanges={conflictReport.branchChanges}
                        branchGroups={conflictReport.branchGroups}
                        fileDetail={conflictReport.fileDetail}
                    />
                    <MasterAssessmentPanel
                        defaultBranch={conflictReport.defaultBranch}
                        branchVsDefault={conflictReport.branchVsDefault}
                    />
                </div>
            )}
            {snapshot && rows.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 13 }}>
                    <div style={{ ...listRow, fontWeight: 600, borderBottom: '1px solid #d0d7de' }}>
                        <div style={colBranch}>Branch</div>
                        <div style={colPr}>PR</div>
                        <div style={colHead}>HEAD</div>
                        <div style={colNum}>Ahead</div>
                        <div style={colNum}>Behind</div>
                        <div style={colCommit}>Last commit</div>
                        <div style={colActions}>Actions</div>
                    </div>
                    {rows.map(({ branch, pr }) => {
                        const isDefault = branch.name === snapshot.defaultBranch;
                        const canPush = !isDefault && !pr && branch.aheadOfDefault > 0 && !!owner && !!repo;
                        // The working tree belongs to the current branch, so a dirty
                        // tree only blocks pushing *that* branch — its PR would omit
                        // the uncommitted work. Other branches push their committed
                        // refs regardless.
                        const blockedByDirty = canPush && branch.current && !!worktree && !worktree.clean;
                        return (
                            <div key={branch.name} style={{ ...listRow, borderBottom: '1px solid #eaeef2' }}>
                                <div style={colBranch} title={branch.name}>
                                    {branch.current && <span title="current branch">● </span>}
                                    <code>{branch.name}</code>
                                </div>
                                <div style={colPr}>
                                    {pr
                                        ? <a href={pr.url} target="_blank" rel="noreferrer">#{pr.number}</a>
                                        : <span style={{ color: '#8c959f' }}>—</span>}
                                </div>
                                <div style={colHead}><code>{branch.sha.slice(0, 8)}</code></div>
                                <div style={colNum}>
                                    {isDefault ? '—' : formatCount(branch.aheadOfDefault, branch.truncated)}
                                </div>
                                <div style={colNum}>
                                    {isDefault ? '—' : formatCount(branch.behindDefault, branch.truncated)}
                                </div>
                                <div style={colCommit}>
                                    {branch.error
                                        ? <span style={{ color: '#cf222e' }}>{branch.error}</span>
                                        : branch.head
                                            ? <span title={`${branch.head.authorName} · ${new Date(branch.head.date).toLocaleString()}`}>{branch.head.message}</span>
                                            : '—'}
                                </div>
                                <div style={{ ...colActions, display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {canPush && !blockedByDirty && (
                                        <button
                                            type="button"
                                            onClick={() => void handlePush(branch)}
                                            disabled={pushingBranch !== null}
                                        >
                                            {pushingBranch === branch.name ? 'Pushing…' : 'Push & open PR'}
                                        </button>
                                    )}
                                    {blockedByDirty && (
                                        <span
                                            style={{ fontSize: 12, color: '#9a6700' }}
                                            title="Working tree has uncommitted changes — commit or stash before pushing"
                                        >
                                            Can't push — working tree dirty
                                        </span>
                                    )}
                                    {pr && (
                                        <button
                                            type="button"
                                            onClick={() => void handleClosePr(pr)}
                                            disabled={closingPr !== null}
                                            title="Close this PR without merging (reopenable on GitHub)"
                                        >
                                            {closingPr === pr.number ? 'Closing…' : 'Close PR'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {worktreeDirty && hasOtherPushable && (
                        <div style={{ textAlign: 'right', fontSize: 11, color: '#8c959f', fontStyle: 'italic', marginTop: 6 }}>
                            Other branches push their committed tip — only the checked-out branch has a working tree, so only it can be dirty.
                        </div>
                    )}
                </div>
            )}
            <Modal
                open={progressModalOpen}
                onClose={() => setProgressModalOpen(false)}
                title="Analyzing local conflicts"
                maxWidth="sm"
                disableBackdropClose
            >
                <ConflictProgressView
                    progress={conflictProgress}
                    processedFiles={processedFiles}
                    defaultBranchName={snapshot?.defaultBranch ?? 'default'}
                />
            </Modal>
        </section>
    );
}

function ConflictProgressView({ progress, processedFiles, defaultBranchName }: { progress: ConflictProgress | null; processedFiles: string[]; defaultBranchName: string }) {
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

// Surfaces working-tree state on refresh: branch ops (fold/dedup/merge) move
// refs but never touch these files, so a dirty tree is worth flagging up front.
function WorkingTreeBanner({ status, busy, error, currentBranch }: { status: WorkingTreeStatus | null; busy: boolean; error: string | null; currentBranch: string | null }) {
    const [open, setOpen] = useState(false);
    if (busy && !status) {
        return <p style={{ margin: '8px 0', fontSize: 12, color: '#57606a', fontStyle: 'italic' }}>Checking working tree…</p>;
    }
    if (error) {
        return (
            <p style={{ margin: '8px 0', fontSize: 12, color: '#cf222e' }}>
                ⚠ Couldn't read working-tree status: {error}
            </p>
        );
    }
    if (!status) return null;
    if (status.clean) {
        return <p style={{ margin: '8px 0', fontSize: 12, color: '#57606a' }}>✓ Working tree clean</p>;
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
        <div style={{ margin: '8px 0', padding: '8px 12px', background: '#fff8c5', border: '1px solid #d4a72c', borderRadius: 4, fontSize: 13 }}>
            <strong>⚠ Working tree not clean</strong>
            {currentBranch && <> on <code>{currentBranch}</code></>} — {parts.join(', ')}.
            <span style={{ color: '#57606a' }}> Branch operations here move refs but don't touch these files — commit or stash before merging/folding.</span>
            {' '}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                style={{ background: 'none', border: 'none', color: '#0969da', cursor: 'pointer', font: 'inherit', padding: 0 }}
            >
                {open ? 'hide' : 'show'} files
            </button>
            {open && (
                <div style={{ marginTop: 6, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12 }}>
                    {groups.filter(([, files]) => files.length > 0).map(([label, files]) => (
                        <div key={label} style={{ marginTop: 4 }}>
                            <span style={{ color: '#57606a' }}>{label}:</span>
                            <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
                                {files.map((file) => <li key={file}>{file}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Explains what the matrix's dots and colors mean — the dot is presence only;
// the cell color carries the 3-way-merge verdict.
function MatrixLegend() {
    const swatch: React.CSSProperties = { display: 'inline-block', width: 11, height: 11, borderRadius: 2, border: '1px solid #d0d7de', verticalAlign: 'middle', marginRight: 4 };
    const item: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 2 };
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: '#57606a', margin: '0 0 8px' }}>
            <span style={item}><span style={{ color: '#1f883d', fontWeight: 'bold' }}>●</span> = branch touches this file (presence)</span>
            <span style={item}><span style={{ ...swatch, background: 'white' }} /> only one branch — safe</span>
            <span style={item}><span style={{ ...swatch, background: '#ddf4ff' }} /> identical content</span>
            <span style={item}><span style={{ ...swatch, background: '#fff8c5' }} /> shared, non-overlapping (clean merge)</span>
            <span style={item}><span style={{ ...swatch, background: '#ffcecb' }} /> real conflict</span>
            <span style={{ fontStyle: 'italic' }}>hover a row's status for details</span>
        </div>
    );
}

// Per-branch assessment against the default branch. A branch whose changed
// files don't intersect what master changed since the merge-base can be merged
// and deleted cleanly — doing so shrinks the matrix and the conflict surface.
function MasterAssessmentPanel({ defaultBranch, branchVsDefault }: { defaultBranch: string; branchVsDefault: BranchVsDefault[] }) {
    const analyzable = branchVsDefault.filter((b) => !b.error);
    if (analyzable.length === 0) return null;
    const clean = analyzable.filter((b) => b.intersection.length === 0);
    const overlapping = analyzable.filter((b) => b.intersection.length > 0);

    return (
        <div style={{ marginTop: 16, padding: '12px 14px', border: '1px solid #d0d7de', borderRadius: 6, fontSize: 13 }}>
            <strong style={{ fontSize: 14 }}>Vs <code>{defaultBranch}</code></strong>
            <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#57606a' }}>
                Whether each branch touches files <code>{defaultBranch}</code> also changed since they diverged.
                Branches that don't are safe to merge &amp; delete — each one you clear shrinks the matrix.
            </p>

            {clean.length > 0 && (
                <div style={{ marginBottom: overlapping.length > 0 ? 10 : 0 }}>
                    <div style={{ color: '#1a7f37', fontWeight: 600, marginBottom: 4 }}>
                        ✓ Clean against {defaultBranch} — safe to merge &amp; delete ({clean.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {clean.map((b) => <li key={b.branch}><code>{b.branch}</code></li>)}
                    </ul>
                </div>
            )}

            {overlapping.length > 0 && (
                <div>
                    <div style={{ color: '#9a6700', fontWeight: 600, marginBottom: 4 }}>
                        ⚠ Overlap with {defaultBranch} — rebase/review before merging ({overlapping.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {overlapping.map((b) => (
                            <li key={b.branch} style={{ marginBottom: 2 }}>
                                <code>{b.branch}</code>{' '}
                                <span style={{ color: '#57606a' }}>
                                    — {b.intersection.length} file{b.intersection.length === 1 ? '' : 's'} also changed on {defaultBranch}:
                                </span>
                                <ul style={{ margin: '2px 0 0', paddingLeft: 16, color: '#57606a' }}>
                                    {b.intersection.map((file) => <li key={file}><code>{file}</code></li>)}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
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


// Flex "table": a header row + one row per branch. Column widths are fixed
// flex-basis so the header and rows line up without any <table> layout.
const listRow: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', padding: '6px 8px' };
const ellipsis: React.CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const colBranch: React.CSSProperties = { ...ellipsis, flex: '2 1 0' };
const colPr: React.CSSProperties = { flex: '0 0 56px' };
const colHead: React.CSSProperties = { flex: '0 0 84px' };
const colNum: React.CSSProperties = { flex: '0 0 64px', textAlign: 'right' };
const colCommit: React.CSSProperties = { ...ellipsis, flex: '3 1 0' };
const colActions: React.CSSProperties = { flex: '0 0 150px' };
