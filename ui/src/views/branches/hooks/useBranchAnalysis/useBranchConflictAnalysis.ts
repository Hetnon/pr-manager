import { useContext, useEffect, useState } from 'react';
import { RepoContext } from '../../../../repo/RepoContext.js';
import type { LocalRepoSnapshot } from '../../readLocalRepo.js';
import { checkLocalConflicts, type ConflictProgress, type LocalConflictReport } from '../../checkLocalConflicts.js';
import { loadCache, createCacheWriter, ensureCacheIgnored } from '../../conflictCache.js';
import { readWorkingTreeStatus, type WorkingTreeStatus } from '../../workingTreeStatus.js';

// Whenever a fresh snapshot lands: scan the working tree, then (if 2+ analyzable branches) run conflict analysis. Both report into one progress modal, file by file.
export function useBranchConflictAnalysis(snapshot: LocalRepoSnapshot | null) {
    const { currentRepoFolderHandle } = useContext(RepoContext);
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
        if (!currentRepoFolderHandle || !snapshot?.defaultBranch) {
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
            // Once a ‹branch›-dedup exists, analyze it instead of the original — the deduped copy is what you'd merge.
            .filter((branchName) => !branchNames.has(`${branchName}-dedup`));
        const targetFolder = currentRepoFolderHandle;
        let cancelled = false;
        // Only open the modal if the work is slow (>300ms) — flashing it on cache hits would be jarring.
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
                    // Git-ignore the cache folder up front so interrupted background writes never leave an untracked folder.
                    void ensureCacheIgnored(targetFolder);
                    // Background writer serializes + coalesces disk writes while the analysis loop keeps computing.
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
                        // Fires even if cancelled: the computed work is still valid for this repo.
                        () => cacheWriter.schedule(),
                    );
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
    }, [snapshot, currentRepoFolderHandle]);

    return {
        conflictReport, setConflictReport, conflictError, conflictBusy,
        conflictProgress, processedFiles, progressModalOpen, setProgressModalOpen,
        worktree, worktreeBusy, worktreeError,
    };
}
