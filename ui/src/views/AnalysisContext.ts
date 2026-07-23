import { createContext } from 'react';
import type { PR } from '@shared/pr.js';
import type { useBranchAnalysis } from './branches/useBranchAnalysis/useBranchAnalysis.js';
import type { usePrAnalysis } from './prs/usePrAnalysis/usePrAnalysis.js';

export interface AnalysisContextValue {
    prs: PR[] | null;          // all the PRs in the chosen repo - null while loading
    prLoadStatus: string;      // transient "Loading…" / "Loaded N at HH:MM"
    prsLoading: boolean;       // true while a (re)load is in flight — drives the refresh banner
    contentError: string | null;
    loadPrs: () => Promise<void>;   // refetch just the PRs (after a merge/close/push or refresh request)
    refreshRepo: () => void;     // full reread: reload PRs + rerun the branch/PR analysis
    // Blocking "refresh status" modal, shown for user-initiated refresh/merge only.
    refreshModalOpen: boolean;      // a user-initiated refresh is being reported
    refreshModalSettled: boolean;   // its network ops have finished — OK can be clicked
    closeRefreshModal: () => void;  // dismiss it (the OK button)
    branchesAnalysis: ReturnType<typeof useBranchAnalysis>;
    prsAnalysis: ReturnType<typeof usePrAnalysis>;
}

// Non-null: shape too large for a meaningful default; AnalysisProvider always supplies it.
export const AnalysisContext = createContext<AnalysisContextValue>(null as unknown as AnalysisContextValue);
