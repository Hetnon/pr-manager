import ProgressModal from './ProgressModal/ProgressModal.js';
import BranchesView from './branches/BranchesView.js';
import PrView from './prs/PrView.js';
import type { View } from '../Header/AppHeader.js';

interface Props {
    view: View;
}

// The content area. The repo data layer (PR fetch + both analyses) lives in AnalysisProvider (mounted in
// MainPage, above this), so checks run regardless of which tablet's is open and switching never re-runs them.
export default function AppMain({ view }: Readonly<Props>) {
    return (
        <main>
            <ProgressModal />
            {view === 'branches' && <BranchesView />}
            {view === 'prs' && <PrView />}
        </main>
    );
}
