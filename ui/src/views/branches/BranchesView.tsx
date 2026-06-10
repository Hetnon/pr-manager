import { useContext } from 'react';
import type { PR } from '@shared/pr.js';
import { RepoContext } from '../../repo/RepoContext.js';
import { AnalysisContext } from '../AnalysisContext.js';
import BranchesPanelHeader from './components/BranchesPanelHeader.js';
import BranchesMessages from './components/BranchesMessages.js';
import WorkingTreeBanner from './components/WorkingTreeBanner.js';
import BranchConflictReport from './components/BranchConflictReport.js';
import BranchList from './components/BranchList.js';
import type { Row } from './types.js';
import styles from './BranchesView.module.css';

// Renders the "Branches" view from the shared analysis (run above the view toggle
// in AnalysisProvider, so it persists across tab switches and reports its progress
// to the top-level modal). Each child owns its own action — DedupPanel the dedup,
// DuplicatesBanner the delete, BranchList the push/close.
export default function BranchesView() {
    const { currentRepoFolderHandle } = useContext(RepoContext);
    const { prs, branchesAnalysis, loadPrs } = useContext(AnalysisContext);
    const {
        snapshot, error, busy, fetching, lastFetch,
        conflictReport, setConflictReport, conflictError, conflictBusy,
        worktree, worktreeBusy, worktreeError, refresh,
    } = branchesAnalysis;

    if (!currentRepoFolderHandle) return null;

    const prByRef = new Map<string, PR>();
    for (const pr of prs ?? []) prByRef.set(pr.headRefName, pr);

    // Once a `‹branch›-dedup` exists it supersedes the original — show (and push)
    // only the deduped copy, so the list matches the matrix's effective branches
    // instead of listing both. (Same rule as the matrix's `others`.)
    const branchNames = new Set((snapshot?.branches ?? []).map((branch) => branch.name));
    const rows: Row[] = (snapshot?.branches ?? [])
        .filter((branch) => !branchNames.has(`${branch.name}-dedup`))
        .map((branch) => ({ branch, pr: prByRef.get(branch.name) ?? null }));

    return (
        <section className={styles.panel}>
            <BranchesPanelHeader busy={busy} fetching={fetching} conflictBusy={conflictBusy} snapshot={snapshot} />
            <BranchesMessages error={error} conflictError={conflictError} lastFetch={lastFetch} />
            <WorkingTreeBanner status={worktree} busy={worktreeBusy} error={worktreeError} currentBranch={snapshot?.currentBranch ?? null} />
            {conflictReport && snapshot && (
                <BranchConflictReport conflictReport={conflictReport} snapshot={snapshot} setConflictReport={setConflictReport} refresh={refresh} />
            )}
            {snapshot && rows.length > 0 && (
                <BranchList rows={rows} snapshot={snapshot} worktree={worktree} refresh={refresh} onPushed={loadPrs} />
            )}
        </section>
    );
}
