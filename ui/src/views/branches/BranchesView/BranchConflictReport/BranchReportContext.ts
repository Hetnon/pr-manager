import { createContext } from 'react';
import type { LocalConflictReport } from '../../checkLocalConflicts.js';
import type { LocalRepoSnapshot } from '../../readLocalRepo.js';
import type { DedupChoices } from './DedupPanel/useDedupChoices.js';

// The dedup controls ride along with the derived report: one useDedupChoices call owns
// both, so splitting them across providers would mean two independent hook instances.
export interface BranchReportContextValue extends DedupChoices {
    rawReport: LocalConflictReport;
    snapshot: LocalRepoSnapshot;
}

export const BranchReportContext = createContext<BranchReportContextValue>(null as unknown as BranchReportContextValue);
