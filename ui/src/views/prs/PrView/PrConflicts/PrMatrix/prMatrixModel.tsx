import type { ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { heatClass, type SharedFileMatrix } from '../../../sharedFiles.js';
import { metaCell } from '../../../../components/metaCell.js';
import type { MatrixColumn, MatrixFileRow } from '../../../../components/Matrix.js';
import type { LegendItem } from '../../../../components/MatrixLegend.js';
import { formatAbsolute, formatTimeAgo } from '../../../../../lib/formatDate.js';
import styles from '../../../../components/Matrix.module.css';

export type CellState = 'conflict' | 'warning' | undefined;

export const META_LABELS = ['Branch Name', "Dev's Name", 'PR Name', 'Created', 'Last Modified'];

export const LEGEND: LegendItem[] = [
    { kind: 'dot', label: '= PR touches this file' },
    { kind: 'safe', label: 'only one PR — safe' },
    { kind: 'conflict', label: 'shared by multiple PRs' },
    { label: '✗ conflicts with base · ⚠ base also touched (clean, review)' },
];

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

export function buildPrColumns(matrix: SharedFileMatrix): MatrixColumn[] {
    const { sortedPrs, prSafe } = matrix;
    return sortedPrs.map((pr) => {
        const safe = prSafe.get(pr.number);
        return {
            key: pr.number,
            header: <a href={pr.url} target="_blank" rel="noopener noreferrer">#{pr.number}</a>,
            headerClassName: safe ? styles.prSafe : styles.prConflict,
            headerTitle: `GitHub: ${pr.mergeStateStatus} | ${pr.mergeable}`,
            meta: [
                metaCell('branch', pr.headRefName, pr.headRefName),
                metaCell('author', pr.author.login, pr.author.login),
                metaCell('title', pr.title, pr.title),
                metaCell('timestamp', formatTimeAgo(pr.createdAt), formatAbsolute(pr.createdAt)),
                metaCell('timestamp', formatTimeAgo(pr.updatedAt), formatAbsolute(pr.updatedAt)),
            ],
            footer: safe ? '✓' : '✗',
            footerClassName: safe ? styles.safe : styles.conflict,
        };
    });
}

export function buildPrFileRows(
    matrix: SharedFileMatrix,
    cellState?: (pr: PR, filePath: string) => CellState,
    renderFileExtra?: (filePath: string) => ReactNode,
): MatrixFileRow[] {
    const { sortedPrs, files } = matrix;
    return files.map(([filePath, prNumbers]) => {
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
}
