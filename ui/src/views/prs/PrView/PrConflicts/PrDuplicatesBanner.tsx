import type { PrGroup } from '@shared/conflicts.js';
import styles from './PrConflicts.module.css';

// Warns when multiple open PRs point at the same HEAD sha (identical PRs),
// suggesting all but one be closed.
export default function PrDuplicatesBanner({ groups }: { groups: PrGroup[] }) {
    const dupes = groups.filter((group) => group.prNumbers.length > 1);
    if (dupes.length === 0) return null;
    const totalRedundant = dupes.reduce((total, group) => total + group.prNumbers.length - 1, 0);
    return (
        <div className={styles.dupesBanner}>
            <strong>⚠ {dupes.length} group{dupes.length === 1 ? '' : 's'} of identical PRs</strong> ({totalRedundant} redundant). Same HEAD sha — consider closing all but one:
            <ul className={styles.dupesList}>
                {dupes.map((group) => (
                    <li key={group.sha} className={styles.dupesItem}>
                        At <code>{group.sha.slice(0, 8)}</code>: {group.prNumbers.map((prNumber, index) => (
                            <span key={prNumber}>
                                #{prNumber}{index === 0 ? ' (keep)' : ''}
                                {index < group.prNumbers.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </li>
                ))}
            </ul>
        </div>
    );
}
