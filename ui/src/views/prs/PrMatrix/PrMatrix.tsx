import { useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { heatClass, type SharedFileMatrix } from '../sharedFiles.js';
import Matrix, { type MatrixColumn, type MatrixFileRow } from '../../../components/Matrix.js';
import PrMatrixSummary from './PrMatrixSummary.js';
import { formatAbsolute, formatTimeAgo } from '../../../lib/formatDate.js';
import styles from '../../../components/Matrix.module.css';

export type CellState = 'conflict' | 'warning' | undefined;

const HEAT: Record<string, string> = { 'heat-1': styles.heat1, 'heat-conflict': styles.heatConflict };

const STATE_CLASS: Record<NonNullable<CellState>, string> = {
    conflict: styles.cellConflict,
    warning: styles.cellWarning,
};
const STATE_GLYPH: Record<NonNullable<CellState>, string> = { conflict: '✗', warning: '⚠' };
const STATE_TITLE: Record<NonNullable<CellState>, string> = {
    conflict: 'Would conflict with the base branch on this file',
    warning: 'The base branch also touched this file (clean merge, but worth a manual review)',
};

const META_LABELS = ['Branch Name', "Dev's Name", 'PR Name', 'Created', 'Last Modified'];

interface Props {
    matrix: SharedFileMatrix;
    cellState?: (pr: PR, filePath: string) => CellState;
    renderFileExtra?: (filePath: string) => ReactNode;
}

// Purely presentational: it renders the matrix it's given. The caller owns the
// input PR set and builds the matrix (PrConflicts builds it from readyToCheck).
export default function PrMatrix({ matrix, cellState, renderFileExtra }: Props) {
    const [expanded, setExpanded] = useState(true);
    const { sortedPrs, files, prSafe, safeCount, hotFileCount } = matrix;

    if (sortedPrs.length === 0) {
        return <p className="empty">No open PRs. 🎉</p>;
    }

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

    const fileRows: MatrixFileRow[] = files.map(([filePath, prNumbers]) => {
        const safe = prNumbers.length === 1;
        const heat = HEAT[heatClass(prNumbers.length)];
        return {
            key: filePath,
            label: filePath,
            labelTitle: filePath,
            labelClassName: heat,
            extra: renderFileExtra?.(filePath),
            status: safe ? '✓' : `✗ ${prNumbers.length}`,
            statusClassName: safe ? styles.safe : styles.conflict,
            cells: sortedPrs.map((pr) => {
                if (!prNumbers.includes(pr.number)) {
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
            <PrMatrixSummary safeCount={safeCount} totalPrs={sortedPrs.length} hotFileCount={hotFileCount} />
            <Matrix
                cornerLabel="PR #"
                metaLabels={META_LABELS}
                columns={columns}
                footerLabel={<strong>Good to Merge? ({files.length} files)</strong>}
                files={fileRows}
                expanded={expanded}
                onToggle={() => setExpanded((isExpanded) => !isExpanded)}
            />
        </>
    );
}
