import { useContext, useState } from 'react';
import RepoSelector from './repo/RepoSelector/RepoSelector.js';
import FolderAccessModal from './repo/FolderAccessModal.js';
import { RepoContext, RepoProvider } from './repo/RepoContext.js';
import { AnalysisProvider } from './views/AnalysisContext.js';
import AppHeader, { type View } from './Header/AppHeader.js';
import AppMain from './views/AppMain.js';


export default function MainPage() {
    return (
        <RepoProvider>
            <RepoSpace />
        </RepoProvider>
    );
}


function RepoSpace() {
    // The page itself: header + the active view + the repo picker overlay.
    const { currentRepoSlug, currentRepoFolderHandle, browserHasAcessToCurrentFolder, repoPickerOpen, restoringRepos } = useContext(RepoContext);
    const [view, setView] = useState<View>('branches');

    if (restoringRepos) return <p className="loading">Loading…</p>;

    if (currentRepoSlug && !browserHasAcessToCurrentFolder) {
        // Folder access was revoked on reload. Re-grant if we still have the handle;
        return repoPickerOpen || !currentRepoFolderHandle ? <RepoSelector /> : <FolderAccessModal />;
    }

    return (
        <AnalysisProvider>
            <AppHeader view={view} setView={setView} />
            <AppMain view={view} />
            {repoPickerOpen && <RepoSelector />}
        </AnalysisProvider>
    );
}

