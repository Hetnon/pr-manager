import type { RefObject } from 'react';
import type { PR } from '@shared/pr.js';
import styles from './PrMatrix.module.css';

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
    sortedPrs: PR[];
    fileCount: number;
    prSafe: Map<number, boolean>;
    expanded: boolean;
    onToggle: () => void;
    fileColRef: RefObject<HTMLTableHeaderCellElement>;
    fileColMinWidth: number | null;
}

export default function PrMatrixHeader({
    sortedPrs, fileCount, prSafe, expanded, onToggle, fileColRef, fileColMinWidth,
}: Props) {
    const fileColStyle = fileColMinWidth ? { minWidth: `${fileColMinWidth}px` } : undefined;
    return (
        <thead>
            <tr>
                <th ref={fileColRef} className={`${styles.fileCol} ${styles.rowLabel}`} style={fileColStyle}>PR #</th>
                <th rowSpan={6} className={styles.statusCol}>Safe?</th>
                {sortedPrs.map((pr) => {
                    const safe = prSafe.get(pr.number);
                    const status = `GitHub: ${pr.mergeStateStatus} | ${pr.mergeable}`;
                    return (
                        <th key={pr.number} className={`${styles.prCol} ${safe ? styles.prSafe : styles.prConflict}`} title={status}>
                            <a className="pr-link" href={pr.url} target="_blank" rel="noopener noreferrer">#{pr.number}</a>
                        </th>
                    );
                })}
            </tr>
            <tr className={styles.prMetaRow}>
                <th className={`${styles.fileCol} ${styles.rowLabel}`}>Branch Name</th>
                {sortedPrs.map((pr) => (
                    <td key={pr.number} className={styles.prMetaCell}>
                        <div className={`${styles.prMetaContent} ${styles.branch}`} title={pr.headRefName}>{pr.headRefName}</div>
                    </td>
                ))}
            </tr>
            <tr className={styles.prMetaRow}>
                <th className={`${styles.fileCol} ${styles.rowLabel}`}>Dev's Name</th>
                {sortedPrs.map((pr) => (
                    <td key={pr.number} className={styles.prMetaCell}>
                        <div className={`${styles.prMetaContent} ${styles.author}`} title={pr.author.login}>{pr.author.login}</div>
                    </td>
                ))}
            </tr>
            <tr className={styles.prMetaRow}>
                <th className={`${styles.fileCol} ${styles.rowLabel}`}>PR Name</th>
                {sortedPrs.map((pr) => (
                    <td key={pr.number} className={styles.prMetaCell}>
                        <div className={`${styles.prMetaContent} ${styles.title}`} title={pr.title}>{pr.title}</div>
                    </td>
                ))}
            </tr>
            <tr className={styles.prMetaRow}>
                <th className={`${styles.fileCol} ${styles.rowLabel}`}>Created</th>
                {sortedPrs.map((pr) => (
                    <td key={pr.number} className={styles.prMetaCell}>
                        <div className={`${styles.prMetaContent} ${styles.timestamp}`} title={formatAbsolute(pr.createdAt)}>{formatTimeAgo(pr.createdAt)}</div>
                    </td>
                ))}
            </tr>
            <tr className={styles.prMetaRow}>
                <th className={`${styles.fileCol} ${styles.rowLabel}`}>Last Modified</th>
                {sortedPrs.map((pr) => (
                    <td key={pr.number} className={styles.prMetaCell}>
                        <div className={`${styles.prMetaContent} ${styles.timestamp}`} title={formatAbsolute(pr.updatedAt)}>{formatTimeAgo(pr.updatedAt)}</div>
                    </td>
                ))}
            </tr>
            <tr className={styles.footerRow}>
                <th className={`${styles.fileCol} ${styles.rowLabel}`}>
                    <button className={styles.rowToggle} onClick={onToggle} aria-expanded={expanded} title={expanded ? 'Hide file rows' : 'Show file rows'}>
                        <span className={styles.triangle}>{expanded ? '▼' : '▶'}</span>
                        <strong>Good to Merge? ({fileCount} files)</strong>
                    </button>
                </th>
                <td className={styles.statusCell} />
                {sortedPrs.map((pr) => {
                    const safe = prSafe.get(pr.number);
                    return <td key={pr.number} className={`${styles.statusCell} ${safe ? styles.safe : styles.conflict}`}>{safe ? '✓' : '✗'}</td>;
                })}
            </tr>
        </thead>
    );
}
