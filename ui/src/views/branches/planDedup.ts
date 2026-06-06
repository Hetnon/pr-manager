import type { LocalConflictReport } from './checkLocalConflicts.js';
import type { FileConflictDetail, FileSeverity } from './lineLevelConflicts.js';

// One offered redundancy-removal: drop, from `donor`, the files that are
// byte-identical to `keeper`. `donor` is always the lower-ordered branch of the
// pair, `keeper` the higher — so applying options left-to-right strips the
// earliest branches the most and leaves each file in the highest-ordered branch
// that has it.
export interface DedupOption {
    donor: string;
    keeper: string;
    files: string[];
}

/**
 * Builds the ordered pairwise dedup options from the per-file identical groups.
 *
 * For every pair (i, j) with i < j in `branchOrder`, collects the files that are
 * identical between branch i and branch j and offers to remove them from branch
 * i (the donor), keeping them in branch j. Options are emitted in (i, then j)
 * order; pairs with no identical files are skipped.
 *
 * Pure — no git, no I/O — so it's cheap to recompute and easy to test.
 */
export function planDedup(branchOrder: string[], fileDetail: Record<string, FileConflictDetail>): DedupOption[] {
    const indexOf = new Map<string, number>();
    branchOrder.forEach((branch, i) => indexOf.set(branch, i));

    // `${lo}|${hi}` (ordered indices) → files identical between those two branches.
    const pairFiles = new Map<string, Set<string>>();
    for (const [file, detail] of Object.entries(fileDetail)) {
        for (const group of detail.identicalGroups ?? []) {
            for (let firstIndex = 0; firstIndex < group.length; firstIndex++) {
                for (let secondIndex = firstIndex + 1; secondIndex < group.length; secondIndex++) {
                    const indexA = indexOf.get(group[firstIndex]);
                    const indexB = indexOf.get(group[secondIndex]);
                    if (indexA === undefined || indexB === undefined) continue;
                    const lowerIndex = Math.min(indexA, indexB);
                    const higherIndex = Math.max(indexA, indexB);
                    const key = `${lowerIndex}|${higherIndex}`;
                    let files = pairFiles.get(key);
                    if (!files) { files = new Set(); pairFiles.set(key, files); }
                    files.add(file);
                }
            }
        }
    }

    const options: DedupOption[] = [];
    for (let i = 0; i < branchOrder.length; i++) {
        for (let j = i + 1; j < branchOrder.length; j++) {
            const files = pairFiles.get(`${i}|${j}`);
            if (!files || files.size === 0) continue;
            options.push({ donor: branchOrder[i], keeper: branchOrder[j], files: [...files].sort() });
        }
    }
    return options;
}

// Collapses approved options into one set of files to strip per donor branch
// (a donor may shed files identical to several keepers). The result feeds the
// git op: for each donor, build a -dedup branch with these files reverted.
export function filesToStripByDonor(approved: DedupOption[]): Map<string, Set<string>> {
    const byDonor = new Map<string, Set<string>>();
    for (const option of approved) {
        let set = byDonor.get(option.donor);
        if (!set) { set = new Set(); byDonor.set(option.donor, set); }
        for (const file of option.files) set.add(file);
    }
    return byDonor;
}

/**
 * Applies a completed dedup directly to the in-memory report — no git reads, no
 * re-analysis. We already know each donor shed specific files, and removing a
 * branch from a file can only *reduce* its conflict, so the new verdict is a
 * pure filter of the data we already have. This is what lets the matrix update
 * instantly (the blues collapse) without re-running the analysis.
 */
export function applyDedupToReport(report: LocalConflictReport, filesByDonor: Map<string, Set<string>>): LocalConflictReport {
    // file → the donors that just dropped it
    const droppedDonorsByFile = new Map<string, Set<string>>();
    for (const [donor, files] of filesByDonor) {
        for (const file of files) {
            let donors = droppedDonorsByFile.get(file);
            if (!donors) { donors = new Set(); droppedDonorsByFile.set(file, donors); }
            donors.add(donor);
        }
    }

    const filesDroppedFrom = (branch: string): Set<string> => {
        const drop = new Set<string>();
        for (const [file, donors] of droppedDonorsByFile) if (donors.has(branch)) drop.add(file);
        return drop;
    };

    const branchChanges = report.branchChanges.map((branchChange) => {
        const drop = filesDroppedFrom(branchChange.branch);
        return drop.size === 0 ? branchChange : { ...branchChange, files: branchChange.files.filter((file) => !drop.has(file)) };
    });

    const branchVsDefault = report.branchVsDefault.map((assessment) => {
        const drop = filesDroppedFrom(assessment.branch);
        return drop.size === 0 ? assessment : { ...assessment, intersection: assessment.intersection.filter((file) => !drop.has(file)) };
    });

    const fileDetail: Record<string, FileConflictDetail> = { ...report.fileDetail };
    for (const [file, donors] of droppedDonorsByFile) {
        const detail = report.fileDetail[file];
        if (detail) fileDetail[file] = recomputeWithout(detail, donors);
    }

    return { ...report, branchChanges, branchVsDefault, fileDetail };
}

// Re-derives a file's verdict after some branches stop touching it, by filtering
// the already-computed detail (no merges re-run).
function recomputeWithout(detail: FileConflictDetail, removed: Set<string>): FileConflictDetail {
    const edits = detail.edits.filter((edit) => !removed.has(edit.branch));
    const conflicts = detail.conflicts.filter((conflict) => !removed.has(conflict.branchA) && !removed.has(conflict.branchB));
    const identicalGroups = (detail.identicalGroups ?? [])
        .map((group) => group.filter((branchName) => !removed.has(branchName)))
        .filter((group) => group.length >= 2);

    const touching = edits.length;
    let severity: FileSeverity;
    if (touching <= 1) severity = 'safe';
    else if (conflicts.length > 0) severity = 'conflict';
    else if (identicalGroups.length === 1 && identicalGroups[0].length === touching) severity = 'identical';
    else severity = 'warning';

    return { severity, edits, conflicts, identicalGroups: identicalGroups.length ? identicalGroups : undefined };
}
