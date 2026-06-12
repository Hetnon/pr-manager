import { useLocalSnapshot } from './useLocalSnapshot.js';
import { useBranchConflictAnalysis } from './useBranchConflictAnalysis.js';

// Everything derived from the local repo folder: the branch snapshot (+ opportunistic
// origin fetch) and the analysis of it (working-tree scan + conflict report). Hosted in
// AnalysisProvider so it survives the branches/PRs view toggle. `refresh` and
// `setConflictReport` are exposed for the actions/dedup flows.
export function useBranchAnalysis(refreshNonce: number) {
    const local = useLocalSnapshot(refreshNonce);
    const analysis = useBranchConflictAnalysis(local.snapshot);
    return { ...local, ...analysis };
}
