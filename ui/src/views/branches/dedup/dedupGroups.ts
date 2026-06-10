import type { FileConflictDetail } from '../lineLevelConflicts.js';

export interface DedupGroup {
    branches: string[];   // branches sharing byte-identical content for every file in `files` (sorted)
    files: string[];      // the identical files (sorted)
}

// Groups duplicate files by the exact set of branches that share them. Each group is
// one redundancy the user resolves by keeping the files in one branch and dropping
// them from the rest.
export function buildDedupGroups(fileDetail: Record<string, FileConflictDetail>): DedupGroup[] {
    const byBranchSet = new Map<string, { branches: string[]; files: Set<string> }>();
    for (const [file, detail] of Object.entries(fileDetail)) {
        for (const identicalBranches of detail.identicalGroups ?? []) {
            if (identicalBranches.length < 2) continue;
            const branches = [...identicalBranches].sort((branchA, branchB) => branchA.localeCompare(branchB));
            const key = branches.join('\n');
            let entry = byBranchSet.get(key);
            if (!entry) { entry = { branches, files: new Set() }; byBranchSet.set(key, entry); }
            entry.files.add(file);
        }
    }
    return [...byBranchSet.values()]
        .map(({ branches, files }) => ({ branches, files: [...files].sort() }))
        .sort((groupA, groupB) => groupA.branches.join().localeCompare(groupB.branches.join()));
}
