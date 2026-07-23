import { useMemo, type ReactNode } from 'react';
import type { LocalConflictReport } from '../../checkLocalConflicts.js';
import type { LocalRepoSnapshot } from '../../readLocalRepo.js';
import { useDedupChoices } from './DedupPanel/useDedupChoices.js';
import { BranchReportContext, type BranchReportContextValue } from './BranchReportContext.js';

export function BranchReportProvider({ conflictReport, snapshot, children }: Readonly<{
    conflictReport: LocalConflictReport;
    snapshot: LocalRepoSnapshot;
    children: ReactNode;
}>) {
    const dedup = useDedupChoices(conflictReport);
    const value = useMemo<BranchReportContextValue>(
        () => ({ ...dedup, rawReport: conflictReport, snapshot }),
        [dedup, conflictReport, snapshot],
    );
    return <BranchReportContext.Provider value={value}>{children}</BranchReportContext.Provider>;
}
