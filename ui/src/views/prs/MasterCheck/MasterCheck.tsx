import { useContext, useMemo, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { AnalysisContext } from '../../../analysis/AnalysisContext.js';
import { formatDateTime, formatRelativeShort } from '../../../lib/formatDate.js';
import { useClosePr } from '../../../hooks/useClosePr.js';
import PrMatrix, { type CellState } from './PrMatrix/PrMatrix.js';
import { usePrActions } from './hooks/usePrActions.js';
import ConflictingPrsPanel from './components/ConflictingPrsPanel.js';
import LocalPairwiseStatus from './components/LocalPairwiseStatus.js';
import PrDuplicatesBanner from './components/PrDuplicatesBanner.js';
import TechLeadActions from './components/TechLeadActions.js';
import panels from '../../../panels.module.css';
import styles from './MasterCheck.module.css';

interface Props {
    onMerged?: () => void;
}

// Composes the master conflict check from the shared PR analysis (the green/non-
// green split, candidate set, and server + browser checks all run app-level in
// AnalysisProvider). MasterCheck owns only the merge/close actions and the
// presentation glue (cell severity + the "master touched" chip).
export default function MasterCheck({ onMerged }: Props) {
    const {
        greens, nonGreens, conflictsByPr, promoted, togglePromoted,
        readyToCheck, readyMatrix, results, loading, error, lookups, masterTouchByFile,
        localPairwise, pairwise,
    } = useContext(AnalysisContext).pr;

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
    //   master-vs-PR: GitHub mergeable bit + master-touched files
    //   PR-vs-PR: pairwise line-level overlap between green PRs
    // Conflict wins over warning; either side can trigger either tier.
    const cellState: ((pr: PR, filePath: string) => CellState) | undefined = lookups
        ? (pr, filePath) => {
            const lookup = lookups.get(pr.number);
            const masterConflict = lookup?.conflicts.has(filePath);
            const masterWarn = lookup?.touched.has(filePath);
            const pairwiseSev = pairwise?.fileSeverity[filePath];
            if (masterConflict || pairwiseSev === 'conflict') return 'conflict';
            if (masterWarn || pairwiseSev === 'warning') return 'warning';
            return undefined;
        }
        : undefined;

    const renderFileExtra: ((filePath: string) => ReactNode) | undefined = masterTouchByFile
        ? (filePath: string) => {
            const info = masterTouchByFile.get(filePath);
            if (!info) return null;
            const masterMs = new Date(info.date).getTime();
            const earliestPr = earliestPrUpdateByFile.get(filePath);
            const stale = earliestPr !== undefined && masterMs > earliestPr;
            const tooltip = `Master last touched ${formatDateTime(info.date)}\n${info.sha}\n${info.subject}${stale ? '\n\n⚠ More recent than the earliest PR touching this file — review.' : ''}`;
            return (
                <div className={`${styles.masterChip} ${stale ? styles.chipStale : ''}`} title={tooltip}>
                    master · {formatRelativeShort(info.date)} · <code>{info.sha.slice(0, 7)}</code>
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
        <div className={panels.section}>
            <h2>Master Conflict Check</h2>
            <p className={panels.intro}>
                Files each candidate PR touches. <span className={panels.legendBad}>Red ✗</span> = real merge conflict with master. <span className={panels.legendWarn}>Yellow ⚠</span> = master also touched this file but it merges cleanly (review for semantic conflicts).
            </p>

            {loading && <p className={panels.status}>Checking {readyToCheck.length} candidate PR(s) against master…</p>}
            {error && <p className="picker-error">{error}</p>}
            {lastClose && (
                <p style={{ margin: '6px 0', color: lastClose.ok ? '#1a7f37' : '#cf222e', fontSize: 13 }}>
                    {lastClose.ok ? '✓ ' : `✗ Couldn't close #${lastClose.prNumber}: `}{lastClose.message}
                </p>
            )}
            <LocalPairwiseStatus state={localPairwise} />
            {pairwise && <PrDuplicatesBanner groups={pairwise.prGroups} />}
            {errors.length > 0 && (
                <ul className={panels.errors}>
                    {errors.map(([prNumber, failure]) => (
                        <li key={prNumber}><strong>#{prNumber}</strong>: {failure.error}</li>
                    ))}
                </ul>
            )}
            {results && allClean && (
                <p className={panels.clean}>✓ All candidate PRs are clean against master.</p>
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
