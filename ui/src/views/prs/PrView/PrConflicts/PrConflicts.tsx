import { useContext, useMemo, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { AnalysisContext } from '../../../AnalysisContext.js';
import { formatDateTime, formatRelativeShort } from '../../../../lib/formatDate.js';
import { useClosePr } from '../../../useClosePr.js';
import PrMatrix, { type CellState } from './PrMatrix/PrMatrix.js';
import { usePrActions } from './usePrActions.js';
import ConflictingPrsPanel from './ConflictingPrsPanel.js';
import LocalPairwiseStatus from './LocalPairwiseStatus.js';
import PrDuplicatesBanner from './PrDuplicatesBanner.js';
import TechLeadActions from './TechLeadActions.js';
import styles from './PrConflicts.module.css';

interface Props {
    onMerged?: () => void;
}

// The PR conflict + merge panel: matrix, conflict panels, and the tech-lead merge/close
// actions. The analysis itself runs app-level in AnalysisProvider; this is presentation glue.
export default function PrConflicts({ onMerged }: Props) {
    const {
        greens, nonGreens, conflictsByPr, promoted, togglePromoted,
        readyToCheck, readyMatrix, results, loading, error, lookups, baseTouchByFile,
        localPairwise, pairwise,
    } = useContext(AnalysisContext).prsAnalysis;

    const {
        merging, lastMerge,
        skipBranchDelete, toggleSkipBranchDelete, handleMerge,
    } = usePrActions(onMerged);
    const { closingPr, lastClose, close: handleClosePr } = useClosePr(onMerged);

    const earliestPrUpdateByFile = useMemo(() => {
        const earliestByFile = new Map<string, number>();
        for (const pr of readyToCheck) {
            const updatedAt = new Date(pr.updatedAt).getTime();
            for (const file of pr.files) {
                const current = earliestByFile.get(file.path);
                if (current === undefined || updatedAt < current) earliestByFile.set(file.path, updatedAt);
            }
        }
        return earliestByFile;
    }, [readyToCheck]);

    if (greens.length === 0 && nonGreens.length === 0) return null;

    // Combine two severity sources into one cellState:
    //   base-vs-PR: GitHub mergeable bit + base-touched files
    //   PR-vs-PR: pairwise line-level overlap between green PRs
    // Conflict wins over warning; either side can trigger either tier.
    const cellState: ((pr: PR, filePath: string) => CellState) | undefined = lookups
        ? (pr, filePath) => {
            const lookup = lookups.get(pr.number);
            const baseConflict = lookup?.conflicts.has(filePath);
            const baseWarn = lookup?.touched.has(filePath);
            const pairwiseSev = pairwise?.fileSeverity[filePath];
            if (baseConflict || pairwiseSev === 'conflict') return 'conflict';
            if (baseWarn || pairwiseSev === 'warning') return 'warning';
            return undefined;
        }
        : undefined;

    const renderFileExtra: ((filePath: string) => ReactNode) | undefined = baseTouchByFile
        ? (filePath: string) => {
            const info = baseTouchByFile.get(filePath);
            if (!info) return null;
            const baseMs = new Date(info.date).getTime();
            const earliestPr = earliestPrUpdateByFile.get(filePath);
            const stale = earliestPr !== undefined && baseMs > earliestPr;
            const tooltip = `Base branch last touched ${formatDateTime(info.date)}\n${info.sha}\n${info.subject}${stale ? '\n\n⚠ More recent than the earliest PR touching this file — review.' : ''}`;
            return (
                <div className={`${styles.baseChip} ${stale ? styles.chipStale : ''}`} title={tooltip}>
                    base · {formatRelativeShort(info.date)} · <code>{info.sha.slice(0, 7)}</code>
                </div>
            );
        }
        : undefined;

    const errors = results
        ? Object.entries(results).filter((entry): entry is [string, { ok: false; error: string }] => !entry[1].ok)
        : [];
    const allClean = results && errors.length === 0
        && Object.values(results).every((result) => result.ok && result.clean);

    const readyToMerge = results
        ? readyToCheck.filter((pr) => {
            const result = results[pr.number];
            return result?.ok && result.clean;
        })
        : [];

    return (
        <div className={styles.section}>
            <h2>Base Conflict Check</h2>
            <p className={styles.intro}>
                Files each candidate PR touches. <span className={styles.legendBad}>Red ✗</span> = real merge conflict with the base branch. <span className={styles.legendWarn}>Yellow ⚠</span> = the base branch also touched this file but it merges cleanly (review for semantic conflicts).
            </p>

            {loading && <p className={styles.status}>Checking {readyToCheck.length} candidate PR(s) against the base branch…</p>}
            {error && <p className="error-banner">{error}</p>}
            {lastClose && (
                <p className={`${styles.closeStatus} ${lastClose.ok ? styles.statusOk : styles.statusBad}`}>
                    {lastClose.ok ? '✓ ' : `✗ Couldn't close #${lastClose.prNumber}: `}{lastClose.message}
                </p>
            )}
            <LocalPairwiseStatus state={localPairwise} />
            {pairwise && <PrDuplicatesBanner groups={pairwise.prGroups} />}
            {errors.length > 0 && (
                <ul className={styles.errors}>
                    {errors.map(([prNumber, failure]) => (
                        <li key={prNumber}><strong>#{prNumber}</strong>: {failure.error}</li>
                    ))}
                </ul>
            )}
            {results && allClean && (
                <p className={styles.clean}>✓ All candidate PRs are clean against the base branch.</p>
            )}

            {nonGreens.length > 0 && (
                <ConflictingPrsPanel
                    nonGreens={nonGreens}
                    promoted={promoted}
                    onToggle={togglePromoted}
                    conflictsByPr={conflictsByPr}
                    onClose={handleClosePr}
                    closingPr={closingPr}
                />
            )}

            {readyToCheck.length > 0 && (
                <PrMatrix matrix={readyMatrix} cellState={cellState} renderFileExtra={renderFileExtra} />
            )}

            {readyToMerge.length > 0 && (
                <TechLeadActions
                    readyToMerge={readyToMerge}
                    lastMerge={lastMerge}
                    merging={merging}
                    closingPr={closingPr}
                    skipBranchDelete={skipBranchDelete}
                    onToggleSkipBranchDelete={toggleSkipBranchDelete}
                    onMerge={handleMerge}
                    onClose={handleClosePr}
                />
            )}
        </div>
    );
}
