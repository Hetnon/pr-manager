import { useMemo, useState } from 'react';
import styles from '../../../components/Matrix.module.css';
import branchStyles from '../BranchesView.module.css';
import Matrix, { type MatrixColumn, type MatrixFileRow } from '../../../components/Matrix.js';
import { formatRelative, formatDateTime } from '../../../../lib/formatDate.js';
import type { LocalBranch } from '../../readLocalRepo.js';
import type { BranchChanges, BranchGroup } from '../../checkLocalConflicts.js';
import type { FileConflictDetail, FileSeverity } from '../../lineLevelConflicts.js';
import type { LineRange } from '../../conflictCache.js';

interface Props {
    defaultBranch: string;
    branches: LocalBranch[];
    branchChanges: BranchChanges[];
    // Groups of branches sharing a HEAD sha. Each branchChange column maps to
    // one group via canonical === branchChange.branch. When omitted, every
    // column is treated as a 1-branch group.
    branchGroups?: BranchGroup[];
    // Per-file 3-way-merge detail from the conflict report. When omitted, falls
    // back to presence-only coloring (multi-branch = warning).
    fileDetail?: Record<string, FileConflictDetail>;
}

interface MatrixData {
    columns: BranchChanges[];
    files: Array<[string, Set<string>]>;
}

const META_LABELS = ['HEAD', 'Author', 'Last commit', 'When'];

function buildBranchMatrix(branchChanges: BranchChanges[]): MatrixData {
    const usable = branchChanges.filter((branchChange) => !branchChange.error && branchChange.files.length > 0);
    const fileToBranches = new Map<string, Set<string>>();
    for (const branchChange of usable) {
        for (const file of branchChange.files) {
            if (!fileToBranches.has(file)) fileToBranches.set(file, new Set());
            fileToBranches.get(file)!.add(branchChange.branch);
        }
    }
    const columns = [...usable].sort((changeA, changeB) => changeA.branch.localeCompare(changeB.branch));
    const files = [...fileToBranches.entries()].sort(([pathA, branchesA], [pathB, branchesB]) => {
        if (branchesB.size !== branchesA.size) return branchesB.size - branchesA.size;
        return pathA.localeCompare(pathB);
    });
    return { columns, files };
}

// File severity with a presence-only fallback for when detail is unavailable.
function severityOf(file: string, touchingCount: number, fileDetail?: Record<string, FileConflictDetail>): FileSeverity {
    return fileDetail?.[file]?.severity ?? (touchingCount > 1 ? 'warning' : 'safe');
}

function heatFor(severity: FileSeverity): string {
    if (severity === 'conflict') return styles.heatConflict;
    if (severity === 'warning') return styles.heatWarning;
    if (severity === 'identical') return styles.heatIdentical;
    return styles.heat1;
}

function formatLineRanges(ranges: LineRange[]): string {
    if (ranges.length === 0) return 'whole file';
    return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}–${end}`)).join(', ');
}

// Human-readable hover text explaining a multi-touch file: the verdict, where
// genuine conflicts land, and what each branch changed.
function describeFile(detail: FileConflictDetail | undefined, branchesTouching: string[]): string | undefined {
    if (!detail || detail.severity === 'safe') return undefined;

    if (detail.severity === 'identical') {
        const group = detail.identicalGroups?.[0] ?? branchesTouching;
        return `Identical content across ${group.length} branches:\n${group.join('\n')}\n\nMerging one makes the others no-ops for this file.`;
    }

    const lines: string[] = [];
    if (detail.severity === 'conflict') {
        lines.push('Real merge conflict on this file:');
        for (const conflict of detail.conflicts) {
            lines.push(`  ${conflict.branchA} ✗ ${conflict.branchB} — base lines ${formatLineRanges(conflict.regions)}`);
        }
    } else {
        lines.push(`Touched by ${branchesTouching.length} branches, but the changes don't overlap (clean 3-way merge).`);
    }

    if (detail.edits.length > 0) {
        lines.push('', 'Each branch changes:');
        for (const edit of detail.edits) {
            if (edit.headMissing) lines.push(`  ${edit.branch}: deletes the file`);
            else if (edit.binary) lines.push(`  ${edit.branch}: binary change`);
            else lines.push(`  ${edit.branch}: lines ${formatLineRanges(edit.ranges)}`);
        }
    }

    for (const group of detail.identicalGroups ?? []) {
        lines.push('', `Identical content in: ${group.join(', ')} (redundant — drop from all but one)`);
    }
    return lines.join('\n');
}

const STATUS_GLYPH: Record<FileSeverity, (count: number) => string> = {
    safe: () => '✓',
    identical: (count) => `= ${count}`,
    warning: (count) => `⚠ ${count}`,
    conflict: (count) => `✗ ${count}`,
};
const STATUS_CLASS: Record<FileSeverity, string> = {
    safe: styles.safe,
    identical: styles.identical,
    warning: styles.heatWarning,
    conflict: styles.conflict,
};

export default function LocalBranchesMatrix({ defaultBranch, branches, branchChanges, branchGroups, fileDetail }: Props) {
    const [expanded, setExpanded] = useState(true);
    const matrix = useMemo(() => buildBranchMatrix(branchChanges), [branchChanges]);

    if (matrix.columns.length === 0) {
        return <p className={styles.summary}>No branches with changes vs <code>{defaultBranch}</code>.</p>;
    }

    // A branch is "in conflict" only if it actually participates in a conflicting
    // pair somewhere — identical/non-overlapping overlaps don't count.
    const conflictBranches = new Set<string>();
    let conflictFiles = 0;
    let warningFiles = 0;
    let identicalFiles = 0;
    for (const [file, branchSet] of matrix.files) {
        const severity = severityOf(file, branchSet.size, fileDetail);
        if (severity === 'conflict') conflictFiles++;
        else if (severity === 'warning') warningFiles++;
        else if (severity === 'identical') identicalFiles++;
        for (const conflict of fileDetail?.[file]?.conflicts ?? []) {
            conflictBranches.add(conflict.branchA);
            conflictBranches.add(conflict.branchB);
        }
    }
    const branchSafe = (branch: string) => !conflictBranches.has(branch);
    const safeCount = matrix.columns.filter((column) => branchSafe(column.branch)).length;

    const headByBranch = new Map(branches.map((branch) => [branch.name, branch]));
    const groupByCanonical = new Map((branchGroups ?? []).map((group) => [group.canonical, group]));

    const columns: MatrixColumn[] = matrix.columns.map((column) => {
        const safe = branchSafe(column.branch);
        const group = groupByCanonical.get(column.branch);
        const extras = group && group.branches.length > 1 ? group.branches.length - 1 : 0;
        const tooltip = group && group.branches.length > 1
            ? `Identical (same HEAD) branches:\n${group.branches.join('\n')}`
            : column.branch;
        const head = headByBranch.get(column.branch)?.head;
        return {
            key: column.branch,
            header: (
                <>
                    <code>{column.branch}</code>
                    {extras > 0 && <span className={branchStyles.extraBadge}>(+{extras})</span>}
                </>
            ),
            headerClassName: safe ? styles.prSafe : styles.prConflict,
            headerTitle: tooltip,
            meta: [
                <div className={`${styles.metaContent} ${styles.branch}`} title={column.sha}>{column.sha.slice(0, 8)}</div>,
                <div className={`${styles.metaContent} ${styles.author}`} title={head ? `${head.authorName} <${head.authorEmail}>` : ''}>{head?.authorName ?? '—'}</div>,
                <div className={`${styles.metaContent} ${styles.title}`} title={head?.message ?? ''}>{head?.message ?? '—'}</div>,
                <div className={`${styles.metaContent} ${styles.timestamp}`} title={head ? formatDateTime(head.date) : ''}>{head ? formatRelative(head.date) : '—'}</div>,
            ],
            footer: safe ? '✓' : '✗',
            footerClassName: safe ? styles.safe : styles.conflict,
        };
    });

    const fileRows: MatrixFileRow[] = matrix.files.map(([filePath, branchSet]) => {
        const detail = fileDetail?.[filePath];
        const severity = severityOf(filePath, branchSet.size, fileDetail);
        const heat = heatFor(severity);
        const branchesTouching = [...branchSet].sort();
        // Branches whose content is identical to another touching branch's: their
        // cells go identical-blue even when the file overall is warning/conflict
        // (e.g. 2 of 3 branches match — those two are blue, the odd one keeps the
        // warning/conflict color).
        const identical = new Set((detail?.identicalGroups ?? []).flat());
        return {
            key: filePath,
            label: filePath,
            labelTitle: filePath,
            labelClassName: heat,
            status: STATUS_GLYPH[severity](branchSet.size),
            statusClassName: STATUS_CLASS[severity],
            statusTitle: describeFile(detail, branchesTouching),
            cells: matrix.columns.map((column) => {
                if (!branchSet.has(column.branch)) return { content: null, className: styles.miss };
                const cellClass = identical.has(column.branch) ? styles.identical : heat;
                return { content: '●', className: `${styles.hit} ${cellClass}` };
            }),
        };
    });

    return (
        <>
            <div className={styles.summary}>
                <strong>{safeCount}</strong> of <strong>{matrix.columns.length}</strong> branch(es) have no real conflicts.
                {' '}Conflicts: <strong>{conflictFiles}</strong> file(s) · Review: {warningFiles} · Identical: {identicalFiles}
                {' · '}vs <code>{defaultBranch}</code>
            </div>
            <Matrix
                cornerLabel="Branch"
                metaLabels={META_LABELS}
                columns={columns}
                footerLabel={<strong>Good to merge? ({matrix.files.length} files)</strong>}
                files={fileRows}
                expanded={expanded}
                onToggle={() => setExpanded((isExpanded) => !isExpanded)}
            />
        </>
    );
}
