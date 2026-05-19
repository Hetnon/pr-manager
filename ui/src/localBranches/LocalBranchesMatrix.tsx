import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from '../prMatrix/PrMatrix.module.css';
import type { LocalBranch } from './readLocalRepo.js';
import type { BranchChanges, BranchGroup } from './checkLocalConflicts.js';
import type { FileSeverity } from './lineLevelConflicts.js';

interface Props {
    defaultBranch: string;
    branches: LocalBranch[];
    branchChanges: BranchChanges[];
    // Groups of branches sharing a HEAD sha. Each branchChange column maps to
    // one group via canonical === branchChange.branch. When omitted, every
    // column is treated as a 1-branch group.
    branchGroups?: BranchGroup[];
    // Per-file line-level severity from the conflict report. If omitted, falls
    // back to file-level coloring (multi-branch = pink, no warning tier).
    fileSeverity?: Record<string, FileSeverity>;
}

interface MatrixData {
    columns: BranchChanges[];
    files: Array<[string, Set<string>]>;
    branchSafe: Map<string, boolean>;
    safeCount: number;
    hotFileCount: number;
}

function buildBranchMatrix(branchChanges: BranchChanges[]): MatrixData {
    const usable = branchChanges.filter((b) => !b.error && b.files.length > 0);
    const fileToBranches = new Map<string, Set<string>>();
    for (const b of usable) {
        for (const f of b.files) {
            if (!fileToBranches.has(f)) fileToBranches.set(f, new Set());
            fileToBranches.get(f)!.add(b.branch);
        }
    }
    const columns = [...usable].sort((a, b) => a.branch.localeCompare(b.branch));
    const files = [...fileToBranches.entries()].sort((a, b) => {
        if (b[1].size !== a[1].size) return b[1].size - a[1].size;
        return a[0].localeCompare(b[0]);
    });
    const branchSafe = new Map<string, boolean>();
    for (const b of columns) {
        const sharesAny = b.files.some((f) => (fileToBranches.get(f)?.size ?? 0) > 1);
        branchSafe.set(b.branch, !sharesAny);
    }
    return {
        columns,
        files,
        branchSafe,
        safeCount: [...branchSafe.values()].filter(Boolean).length,
        hotFileCount: files.filter(([, b]) => b.size > 1).length,
    };
}

// Maps a file's line-level severity to a heat class. Without a severity map,
// falls back to the file-level rule (multi-branch = heatConflict).
function severityOf(file: string, safe: boolean, fileSeverity?: Record<string, FileSeverity>): FileSeverity {
    if (safe) return 'safe';
    if (!fileSeverity) return 'conflict';
    return fileSeverity[file] ?? 'conflict';
}

function heatFor(severity: FileSeverity): string {
    if (severity === 'safe') return styles.heat1;
    if (severity === 'warning') return styles.heatWarning;
    return styles.heatConflict;
}

function formatRelative(iso: string | undefined): string {
    if (!iso) return '';
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.round(days / 30)}mo ago`;
    return `${Math.round(days / 365)}y ago`;
}

export default function LocalBranchesMatrix({ defaultBranch, branches, branchChanges, branchGroups, fileSeverity }: Props) {
    const [expanded, setExpanded] = useState(true);
    const [fileColWidth, setFileColWidth] = useState<number | null>(null);
    const fileColRef = useRef<HTMLTableHeaderCellElement>(null);
    const matrix = useMemo(() => buildBranchMatrix(branchChanges), [branchChanges]);

    useLayoutEffect(() => {
        if (expanded && fileColRef.current) {
            setFileColWidth(fileColRef.current.getBoundingClientRect().width);
        }
    }, [expanded, branchChanges]);

    if (matrix.columns.length === 0) {
        return <p className={styles.summary}>No branches with changes vs <code>{defaultBranch}</code>.</p>;
    }

    const headByBranch = new Map(branches.map((b) => [b.name, b]));
    const groupByCanonical = new Map((branchGroups ?? []).map((g) => [g.canonical, g]));
    const fileColStyle = fileColWidth ? { minWidth: `${fileColWidth}px` } : undefined;

    return (
        <>
            <div className={styles.summary}>
                <strong>{matrix.safeCount}</strong> of <strong>{matrix.columns.length}</strong> branch(es)
                touch files no other branch touches. Hot files: {matrix.hotFileCount}
                {' · '}vs <code>{defaultBranch}</code>
            </div>
            <table className={styles.matrix}>
                <thead>
                    <tr>
                        <th ref={fileColRef} className={`${styles.fileCol} ${styles.rowLabel}`} style={fileColStyle}>Branch</th>
                        <th rowSpan={5} className={styles.statusCol}>Safe?</th>
                        {matrix.columns.map((col) => {
                            const safe = matrix.branchSafe.get(col.branch);
                            const group = groupByCanonical.get(col.branch);
                            const extras = group && group.branches.length > 1 ? group.branches.length - 1 : 0;
                            const tooltip = group && group.branches.length > 1
                                ? `Identical (same HEAD) branches:\n${group.branches.join('\n')}`
                                : col.branch;
                            return (
                                <th
                                    key={col.branch}
                                    className={`${styles.prCol} ${safe ? styles.prSafe : styles.prConflict}`}
                                    title={tooltip}
                                >
                                    <code>{col.branch}</code>
                                    {extras > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: '#57606a' }}>(+{extras})</span>}
                                </th>
                            );
                        })}
                    </tr>
                    <tr className={styles.prMetaRow}>
                        <th className={`${styles.fileCol} ${styles.rowLabel}`}>HEAD</th>
                        {matrix.columns.map((col) => (
                            <td key={col.branch} className={styles.prMetaCell}>
                                <div className={`${styles.prMetaContent} ${styles.branch}`} title={col.sha}>
                                    {col.sha.slice(0, 8)}
                                </div>
                            </td>
                        ))}
                    </tr>
                    <tr className={styles.prMetaRow}>
                        <th className={`${styles.fileCol} ${styles.rowLabel}`}>Author</th>
                        {matrix.columns.map((col) => {
                            const head = headByBranch.get(col.branch)?.head;
                            return (
                                <td key={col.branch} className={styles.prMetaCell}>
                                    <div className={`${styles.prMetaContent} ${styles.author}`} title={head ? `${head.authorName} <${head.authorEmail}>` : ''}>
                                        {head?.authorName ?? '—'}
                                    </div>
                                </td>
                            );
                        })}
                    </tr>
                    <tr className={styles.prMetaRow}>
                        <th className={`${styles.fileCol} ${styles.rowLabel}`}>Last commit</th>
                        {matrix.columns.map((col) => {
                            const head = headByBranch.get(col.branch)?.head;
                            return (
                                <td key={col.branch} className={styles.prMetaCell}>
                                    <div className={`${styles.prMetaContent} ${styles.title}`} title={head?.message ?? ''}>
                                        {head?.message ?? '—'}
                                    </div>
                                </td>
                            );
                        })}
                    </tr>
                    <tr className={styles.prMetaRow}>
                        <th className={`${styles.fileCol} ${styles.rowLabel}`}>When</th>
                        {matrix.columns.map((col) => {
                            const head = headByBranch.get(col.branch)?.head;
                            return (
                                <td key={col.branch} className={styles.prMetaCell}>
                                    <div className={`${styles.prMetaContent} ${styles.timestamp}`} title={head ? new Date(head.date).toLocaleString() : ''}>
                                        {head ? formatRelative(head.date) : '—'}
                                    </div>
                                </td>
                            );
                        })}
                    </tr>
                    <tr className={styles.footerRow}>
                        <th className={`${styles.fileCol} ${styles.rowLabel}`}>
                            <button
                                className={styles.rowToggle}
                                onClick={() => setExpanded((v) => !v)}
                                aria-expanded={expanded}
                                title={expanded ? 'Hide file rows' : 'Show file rows'}
                            >
                                <span className={styles.triangle}>{expanded ? '▼' : '▶'}</span>
                                <strong>Good to merge? ({matrix.files.length} files)</strong>
                            </button>
                        </th>
                        <td className={styles.statusCell} />
                        {matrix.columns.map((col) => {
                            const safe = matrix.branchSafe.get(col.branch);
                            return <td key={col.branch} className={`${styles.statusCell} ${safe ? styles.safe : styles.conflict}`}>{safe ? '✓' : '✗'}</td>;
                        })}
                    </tr>
                </thead>
                {expanded && (
                    <tbody>
                        {matrix.files.map(([filePath, branchSet]) => {
                            const safe = branchSet.size === 1;
                            const severity = severityOf(filePath, safe, fileSeverity);
                            const heat = heatFor(severity);
                            const statusGlyph = safe ? '✓' : severity === 'warning' ? `⚠ ${branchSet.size}` : `✗ ${branchSet.size}`;
                            const statusCls = safe ? styles.safe : severity === 'warning' ? '' : styles.conflict;
                            return (
                                <tr key={filePath}>
                                    <td className={`${styles.fileCell} ${heat}`} title={filePath}>
                                        <div>{filePath}</div>
                                    </td>
                                    <td className={`${styles.statusCell} ${statusCls} ${severity === 'warning' ? heat : ''}`}>
                                        {statusGlyph}
                                    </td>
                                    {matrix.columns.map((col) => (
                                        branchSet.has(col.branch)
                                            ? <td key={col.branch} className={`${styles.hit} ${heat}`}>●</td>
                                            : <td key={col.branch} className={styles.miss} />
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                )}
            </table>
        </>
    );
}
