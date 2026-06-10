import type { LocalConflictReport } from '../checkLocalConflicts.js';
import type { FileConflictDetail, FileSeverity } from '../lineLevelConflicts.js';

// Patches the report in place after a dedup — drops the deduped files from each donor
// branch and re-derives only the affected file verdicts by filtering the data we already
// have (no git, no re-analysis), which is what lets the matrix update instantly.
export function applyDedupToReport(report: LocalConflictReport, filesByDonor: Map<string, Set<string>>): LocalConflictReport {
    const droppedDonorsByFile = new Map<string, Set<string>>();
    for (const [donor, files] of filesByDonor) {
        for (const file of files) {
            let donors = droppedDonorsByFile.get(file);
            if (!donors) { donors = new Set(); droppedDonorsByFile.set(file, donors); }
            donors.add(donor);
        }
    }

    const filesDroppedFrom = (branch: string): Set<string> => {
        const dropped = new Set<string>();
        for (const [file, donors] of droppedDonorsByFile) if (donors.has(branch)) dropped.add(file);
        return dropped;
    };

    const branchChanges = report.branchChanges.map((branchChange) => {
        const dropped = filesDroppedFrom(branchChange.branch);
        return dropped.size === 0 ? branchChange : { ...branchChange, files: branchChange.files.filter((file) => !dropped.has(file)) };
    });

    const branchVsDefault = report.branchVsDefault.map((assessment) => {
        const dropped = filesDroppedFrom(assessment.branch);
        return dropped.size === 0 ? assessment : { ...assessment, intersection: assessment.intersection.filter((file) => !dropped.has(file)) };
    });

    const fileDetail: Record<string, FileConflictDetail> = { ...report.fileDetail };
    for (const [file, donors] of droppedDonorsByFile) {
        const detail = report.fileDetail[file];
        if (detail) fileDetail[file] = recomputeWithoutBranches(detail, donors);
    }

    return { ...report, branchChanges, branchVsDefault, fileDetail };
}

// Re-derives a file's verdict after some branches stop touching it, by filtering the
// already-computed detail — no merges re-run.
function recomputeWithoutBranches(detail: FileConflictDetail, removed: Set<string>): FileConflictDetail {
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
