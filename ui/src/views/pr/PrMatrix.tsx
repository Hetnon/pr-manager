import { useMemo, useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { buildSharedFileMatrix, heatClass } from './sharedFiles.js';
import Matrix, { type MatrixColumn, type MatrixFileRow } from '../../components/Matrix.js';
import PrMatrixSummary from './PrMatrixSummary.js';
import styles from '../../components/Matrix.module.css';

export type CellState = 'conflict' | 'warning' | undefined;

const HEAT: Record<string, string> = { 'heat-1': styles.heat1, 'heat-conflict': styles.heatConflict };

const STATE_CLASS: Record<NonNullable<CellState>, string> = {
    conflict: styles.cellConflict,
    warning: styles.cellWarning,
};
const STATE_GLYPH: Record<NonNullable<CellState>, string> = { conflict: '✗', warning: '⚠' };
const STATE_TITLE: Record<NonNullable<CellState>, string> = {
    conflict: 'Would conflict with master on this file',
    warning: 'Master also touched this file (clean merge, but worth a manual review)',
};

const META_LABELS = ['Branch Name', "Dev's Name", 'PR Name', 'Created', 'Last Modified'];

function formatRelative(iso: string | undefined): string {
    if (!iso) return '';
    const created = new Date(iso);
    const now = new Date();
    const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((todayDay.getTime() - createdDay.getTime()) / 86400000);

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function formatDateTime(iso: string | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString([], {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatAbsolute(iso: string | undefined): string {
    if (!iso) return '';
    return `Local: ${new Date(iso).toString()}\nSource (UTC): ${iso}`;
}

function formatTimeAgo(iso: string | undefined): string {
    if (!iso) return '';
    return `${formatDateTime(iso)} (${formatRelative(iso)})`;
}

interface Props {
    prs: PR[];
    cellState?: (pr: PR, filePath: string) => CellState;
    renderFileExtra?: (filePath: string) => ReactNode;
}

export default function PrMatrix({ prs, cellState, renderFileExtra }: Props) {
    const [expanded, setExpanded] = useState(true);
    const matrix = useMemo(() => buildSharedFileMatrix(prs), [prs]);

    if (prs.length === 0) {
        return <p className="empty">No open PRs. 🎉</p>;
    }

    const { sortedPrs, files, prSafe, safeCount, hotFileCount } = matrix;

    const columns: MatrixColumn[] = sortedPrs.map((pr) => {
        const safe = prSafe.get(pr.number);
        return {
            key: pr.number,
            header: <a className="pr-link" href={pr.url} target="_blank" rel="noopener noreferrer">#{pr.number}</a>,
            headerClassName: safe ? styles.prSafe : styles.prConflict,
            headerTitle: `GitHub: ${pr.mergeStateStatus} | ${pr.mergeable}`,
            meta: [
                <div className={`${styles.metaContent} ${styles.branch}`} title={pr.headRefName}>{pr.headRefName}</div>,
                <div className={`${styles.metaContent} ${styles.author}`} title={pr.author.login}>{pr.author.login}</div>,
                <div className={`${styles.metaContent} ${styles.title}`} title={pr.title}>{pr.title}</div>,
                <div className={`${styles.metaContent} ${styles.timestamp}`} title={formatAbsolute(pr.createdAt)}>{formatTimeAgo(pr.createdAt)}</div>,
                <div className={`${styles.metaContent} ${styles.timestamp}`} title={formatAbsolute(pr.updatedAt)}>{formatTimeAgo(pr.updatedAt)}</div>,
            ],
            footer: safe ? '✓' : '✗',
            footerClassName: safe ? styles.safe : styles.conflict,
        };
    });

    const fileRows: MatrixFileRow[] = files.map(([filePath, prNums]) => {
        const safe = prNums.length === 1;
        const heat = HEAT[heatClass(prNums.length)];
        return {
            key: filePath,
            label: filePath,
            labelTitle: filePath,
            labelClassName: heat,
            extra: renderFileExtra?.(filePath),
            status: safe ? '✓' : `✗ ${prNums.length}`,
            statusClassName: safe ? styles.safe : styles.conflict,
            cells: sortedPrs.map((pr) => {
                if (!prNums.includes(pr.number)) {
                    return { content: null, className: styles.miss };
                }
                const state = cellState?.(pr, filePath);
                const stateCls = state ? STATE_CLASS[state] : '';
                const glyph = state ? STATE_GLYPH[state] : '●';
                const title = state ? STATE_TITLE[state] : undefined;
                return { content: glyph, className: `${styles.hit} ${heat} ${stateCls}`, title };
            }),
        };
    });

    return (
        <>
            <PrMatrixSummary safeCount={safeCount} totalPrs={prs.length} hotFileCount={hotFileCount} />
            <Matrix
                cornerLabel="PR #"
                metaLabels={META_LABELS}
                columns={columns}
                footerLabel={<strong>Good to Merge? ({files.length} files)</strong>}
                files={fileRows}
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
            />
        </>
    );
}
