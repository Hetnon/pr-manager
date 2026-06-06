import { AnalysisProvider } from '../analysis/AnalysisContext.js';
import ProgressModal from '../analysis/ProgressModal.js';
import BranchesView from './branches/BranchesView.js';
import PrView from './prs/PrView.js';
import type { View } from '../Header/AppHeader.js';

interface Props {
    view: View;
    refreshNonce: number;
}

// The content area. A hard toggle: exactly one of the two views renders. The repo
// data layer (PR fetch + both analyses) lives in AnalysisProvider above the toggle,
// so checks run regardless of which tab is open and switching never re-runs them.
export default function AppMain({ view, refreshNonce }: Readonly<Props>) {
    return (
        <main>
            <AnalysisProvider refreshNonce={refreshNonce}>
                <ProgressModal />
                {view === 'branches' && <BranchesView />}
                {view === 'prs' && <PrView />}
            </AnalysisProvider>
        </main>
    );
}
