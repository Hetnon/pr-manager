import { useEffect, useState } from 'react';
import { readLocalRepo, type LocalRepoSnapshot } from '../readLocalRepo.js';
import { checkLocalConflicts, type ConflictProgress, type LocalConflictReport } from '../checkLocalConflicts.js';
import { loadCache, createCacheWriter, ensureCacheIgnored } from '../conflictCache.js';
import { fetchOrigin, type FetchResult } from '../fetchOrigin.js';
import { readWorkingTreeStatus, type WorkingTreeStatus } from '../workingTreeStatus.js';

// Reads the local repo and analyzes it. Owns everything derived from the folder:
// the branch snapshot, the opportunistic origin fetch, the working-tree scan, and
// the 3-way-merge conflict report — plus the progress modal state. Two effects:
// reread on folderHandle/refresh changes, then scan+analyze whenever a fresh snapshot
// lands. Exposes `refresh` and `setConflictReport` (the dedup flow patches the
// report in place) for the actions hook.
export function useBranchAnalysis(
    folderHandle: FileSystemDirectoryHandle | null,
    owner: string | null,
    repo: string | null,
    refreshNonce: number,
) {
    const [snapshot, setSnapshot] = useState<LocalRepoSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [lastFetch, setLastFetch] = useState<FetchResult | null>(null);
    const [conflictReport, setConflictReport] = useState<LocalConflictReport | null>(null);
    const [conflictError, setConflictError] = useState<string | null>(null);
    const [conflictBusy, setConflictBusy] = useState(false);
    const [conflictProgress, setConflictProgress] = useState<ConflictProgress | null>(null);
    const [processedFiles, setProcessedFiles] = useState<string[]>([]);
    const [progressModalOpen, setProgressModalOpen] = useState(false);
    const [worktree, setWorktree] = useState<WorkingTreeStatus | null>(null);
    const [worktreeBusy, setWorktreeBusy] = useState(false);
    const [worktreeError, setWorktreeError] = useState<string | null>(null);

    useEffect(() => {
        if (!folderHandle) {
            setSnapshot(null);
            setError(null);
            setConflictReport(null);
            setConflictError(null);
            setWorktree(null);
            setWorktreeError(null);
            return;
        }
        void runRefresh(folderHandle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folderHandle, refreshNonce]);

    async function load(targetFolder: FileSystemDirectoryHandle) {
        setBusy(true);
        setError(null);
        setConflictReport(null);
        setConflictError(null);
        setWorktree(null);
        try {
            // Folder read+write is guaranteed by the app's entry gate, so we read
            // straight away — no permission check here.
            const snap = await readLocalRepo(targetFolder);
            setSnapshot(snap);
            // The working-tree scan + conflict analysis run together in the effect
            // below (one progress modal), triggered by this snapshot change.
        } catch (caughtError) {
            setError(caughtError instanceof Error ? `${caughtError.name}: ${caughtError.message}` : String(caughtError));
        } finally {
            setBusy(false);
        }
    }

    // Unified refresh — reread local state, then do an opportunistic fetch + prune
    // (folder read+write is guaranteed by the entry gate).
    //
    // Note: we DON'T reread after a successful fetch. fetch only updates
    // refs/remotes/origin/*; readLocalRepo only reads refs/heads/* — local
    // branches and their SHAs are unchanged by fetch. Skipping the post-fetch
    // reread avoids a visible flash where the matrix unmounts (load clears
    // conflictReport) then re-mounts on cache hit.
    async function runRefresh(targetFolder: FileSystemDirectoryHandle) {
        await load(targetFolder);
        if (!owner || !repo) return;
        let result: FetchResult;
        setFetching(true);
        try {
            result = await fetchOrigin(targetFolder, owner, repo);
        } finally {
            setFetching(false);
        }
        setLastFetch(result);
    }

    // Auto-run, whenever a fresh snapshot lands: first scan the working tree,
    // then (if there are 2+ analyzable branches) run conflict analysis. Both
    // report into the same progress modal — "Scanning working tree → Analyzing
    // conflicts", file by file. Same no-button pattern as MasterCheck.
    useEffect(() => {
        if (!folderHandle || !snapshot?.defaultBranch) {
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
        const branchNames = new Set(snapshot.branches.map((branch) => branch.name));
        const branchesToAnalyze = snapshot.branches
            .map((branch) => branch.name)
            .filter((branchName) => branchName !== defaultBranch)
            // Once a `‹branch›-dedup` exists, analyze it instead of the original —
            // the deduplicated copy is the one you'd merge, and this is what makes
            // the redundant (blue) overlaps collapse after applying dedup.
            .filter((branchName) => !branchNames.has(`${branchName}-dedup`));
        const targetFolder = folderHandle;
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
                    const status = await readWorkingTreeStatus(targetFolder, (event) => {
                        if (!cancelled) setConflictProgress({ phase: 'worktree', file: event.file, scanned: event.scanned });
                    });
                    if (!cancelled) setWorktree(status);
                } catch (caughtError) {
                    if (!cancelled) setWorktreeError(caughtError instanceof Error ? `${caughtError.name}: ${caughtError.message}` : String(caughtError));
                } finally {
                    if (!cancelled) setWorktreeBusy(false);
                }
                if (cancelled) return;

                // Phase 2: conflict analysis (needs 2+ analyzable branches).
                if (branchesToAnalyze.length === 0) {
                    setConflictReport(null);
                    setConflictProgress({ phase: 'done', elapsedMs: 0 });
                    return;
                }
                setConflictBusy(true);
                try {
                    const cache = await loadCache(targetFolder);
                    if (cancelled) return;
                    // Git-ignore the cache folder up front so the background writes
                    // below never leave an untracked folder visible if interrupted.
                    void ensureCacheIgnored(targetFolder);
                    // Background writer: the analysis loop just signals new work and
                    // keeps computing; this serializes + coalesces the disk writes.
                    const cacheWriter = createCacheWriter(targetFolder, cache);
                    const report = await checkLocalConflicts(
                        targetFolder, defaultBranch, branchesToAnalyze, cache,
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
                } catch (caughtError) {
                    if (!cancelled) setConflictError(caughtError instanceof Error ? `${caughtError.name}: ${caughtError.message}` : String(caughtError));
                } finally {
                    if (!cancelled) setConflictBusy(false);
                }
            } finally {
                clearTimeout(modalDelayTimer);
                if (!cancelled) setProgressModalOpen(false);
            }
        })();
        return () => { cancelled = true; clearTimeout(modalDelayTimer); };
    }, [snapshot, folderHandle]);

    return {
        snapshot, error, busy, fetching, lastFetch,
        conflictReport, setConflictReport, conflictError, conflictBusy,
        conflictProgress, processedFiles, progressModalOpen, setProgressModalOpen,
        worktree, worktreeBusy, worktreeError,
        refresh: runRefresh,
    };
}
