import { createContext, useMemo, type ReactNode } from 'react';
import type { LocalConflictReport } from '../../checkLocalConflicts.js';
import type { LocalRepoSnapshot } from '../../readLocalRepo.js';
import { useDedupChoices, type DedupChoices } from './DedupPanel/useDedupChoices.js';

// The dedup controls ride along with the derived report: one useDedupChoices call owns
// both, so splitting them across providers would mean two independent hook instances.
export interface BranchReportContextValue extends DedupChoices {
    rawReport: LocalConflictReport;
    snapshot: LocalRepoSnapshot;
}

export const BranchReportContext = createContext<BranchReportContextValue>(null as unknown as BranchReportContextValue);

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
