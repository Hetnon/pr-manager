import { useState } from 'react';
import type { LocalConflictReport } from '../checkLocalConflicts.js';
import { createDedupBranch } from './createDedupBranch.js';
import { applyDedupToReport } from './applyDedupToReport.js';
import { workingTreeBlockReason } from '../workingTreeStatus.js';

// Owns the "create dedup branches" action and its busy/result state. Patches the report
// in place on success so the matrix updates without re-analysis.
export function useDedup(
    currentRepoFolderHandle: FileSystemDirectoryHandle | null,
    conflictReport: LocalConflictReport | null,
    setConflictReport: React.Dispatch<React.SetStateAction<LocalConflictReport | null>>,
) {
    const [dedupBusy, setDedupBusy] = useState(false);
    const [lastDedup, setLastDedup] = useState<{ ok: boolean; message: string } | null>(null);

    // filesByDonor: for each branch that should DROP files, the files it drops (already
    // resolved from the user's per-group keeper choice — the keeper isn't a donor).
    async function applyDedup(filesByDonor: Map<string, Set<string>>) {
        if (!currentRepoFolderHandle || !conflictReport || filesByDonor.size === 0) return;
        setDedupBusy(true);
        setLastDedup(null);
        try {
            const blockReason = await workingTreeBlockReason(currentRepoFolderHandle, 'creating dedup branches');
            if (blockReason) {
                setLastDedup({ ok: false, message: blockReason });
                return;
            }
            const branchChangeByName = new Map(conflictReport.branchChanges.map((branchChange) => [branchChange.branch, branchChange]));
            const created: string[] = [];
            const errors: string[] = [];
            const appliedByDonor = new Map<string, Set<string>>();
            for (const [donor, files] of filesByDonor) {
                const branchChange = branchChangeByName.get(donor);
                if (!branchChange || branchChange.error || !branchChange.base) {
                    errors.push(`${donor}: no merge-base to revert against`);
                    continue;
                }
                try {
                    const result = await createDedupBranch(currentRepoFolderHandle, donor, branchChange.sha, branchChange.base, [...files]);
                    created.push(`${result.dedupBranch} (−${result.reverted + result.deleted} files)`);
                    appliedByDonor.set(donor, files);
                } catch (error) {
                    errors.push(`${donor}: ${(error as Error).message}`);
                }
            }
            const parts: string[] = [];
            if (created.length) parts.push(`Created ${created.join(', ')}`);
            if (errors.length) parts.push(`Errors: ${errors.join('; ')}`);
            setLastDedup({ ok: errors.length === 0, message: parts.join(' · ') || 'Nothing to do.' });
            if (appliedByDonor.size > 0) {
                setConflictReport((prev) => (prev ? applyDedupToReport(prev, appliedByDonor) : prev));
            }
        } finally {
            setDedupBusy(false);
        }
    }

    return { dedupBusy, lastDedup, applyDedup };
}
