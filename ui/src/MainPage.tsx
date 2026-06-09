import { useContext, useState } from 'react';
import RepoSelector from './repo/RepoSelector.js';
import FolderAccessModal from './repo/FolderAccessModal.js';
import { RepoContext, RepoProvider } from './repo/RepoContext.js';
import { AnalysisProvider } from './analysis/AnalysisContext.js';
import AppHeader, { type View } from './Header/AppHeader.js';
import AppMain from './views/AppMain.js';


export default function MainPage() {
    return (
        <RepoProvider>
            <RepoSpace />
        </RepoProvider>
    );
}

// The page itself: header + the active view + the repo picker overlay.
function RepoSpace() {
    const { currentRepoSlug, currentRepoFolderHandle, browserHasAcessToCurrentFolder, repoPickerOpen } = useContext(RepoContext);
    const [view, setView] = useState<View>('branches');
    

    if (currentRepoSlug && !browserHasAcessToCurrentFolder) {
        // happens on page reload when folder has default value but access was revoked
        if (!currentRepoFolderHandle) return null;                          // restoring the handle (brief)
        return repoPickerOpen ? <RepoSelector /> : <FolderAccessModal />;
    }

    // AnalysisProvider wraps both the header and the content so the header's ↻ Refresh
    // can trigger a reload from context (no prop-drilling) and the views read the results.
    return (
        <AnalysisProvider>
            <AppHeader view={view} onSelectView={setView} />
            <AppMain view={view} />
            {repoPickerOpen && <RepoSelector />}
        </AnalysisProvider>
    );
}

