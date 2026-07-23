import { useContext, useMemo, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { AnalysisContext } from '../../../AnalysisContext.js';
import { formatDateTime, formatRelativeShort } from '../../../../lib/formatDate.js';
import { useClosePr } from '../../../useClosePr.js';
import { usePrActions } from './usePrActions.js';
import { PrConflictsContext, type PrConflictsContextValue } from './PrConflictsContext.js';
import styles from './PrConflicts.module.css';

export function PrConflictsProvider({ onMerged, children }: Readonly<{ onMerged?: () => void; children: ReactNode }>) {
    const prsAnalysis = useContext(AnalysisContext).prsAnalysis;
    const actions = usePrActions(onMerged);
    const closeActions = useClosePr(onMerged);
    const { readyToCheck, results, lookups, baseTouchByFile, pairwise } = prsAnalysis;

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

    // base-vs-PR (GitHub mergeable bit + base-touched files) and PR-vs-PR pairwise overlap
    // collapse into one cell severity; conflict wins over warning.
    const cellState: PrConflictsContextValue['cellState'] = lookups
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

    const renderFileExtra: PrConflictsContextValue['renderFileExtra'] = baseTouchByFile
        ? (filePath) => {
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

    const errors: PrConflictsContextValue['errors'] = results
        ? Object.entries(results).filter((entry): entry is [string, { ok: false; error: string }] => !entry[1].ok)
        : [];
    const allClean = !!results && errors.length === 0 && Object.values(results).every((result) => result.ok && result.clean);
    const readyToMerge = results
        ? readyToCheck.filter((pr) => {
            const result = results[pr.number];
            return result?.ok && result.clean;
        })
        : [];

    const value = useMemo<PrConflictsContextValue>(
        () => ({ ...prsAnalysis, ...actions, ...closeActions, cellState, renderFileExtra, readyToMerge, errors, allClean }),
        [prsAnalysis, actions, closeActions, cellState, renderFileExtra, readyToMerge, errors, allClean],
    );
    return <PrConflictsContext.Provider value={value}>{children}</PrConflictsContext.Provider>;
}
