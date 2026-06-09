import { useContext, useState } from 'react';
import RepoSelector from './repo/RepoSelector.js';
import FolderAccessModal from './repo/FolderAccessModal.js';
import { RepoContext } from './repo/RepoContext.js';
import { AnalysisProvider } from './analysis/AnalysisContext.js';
import AppHeader, { type View } from './Header/AppHeader.js';
import AppMain from './views/AppMain.js';

// The page itself: header + the active view + the repo picker overlay. The
// provider stack and DOM mount live in main.tsx (Root).
export default function MainPage() {
    const { repoSlug, folderHandle, hasFolderAccess, pickerOpen } = useContext(RepoContext);
    const [view, setView] = useState<View>('branches');

    // A saved repo whose folder access the browser dropped on reload (or whose
    // handle is still being restored) — block the whole app until access is
    // (re)granted, so no analysis ever runs without it. The grant modal (or the
    // picker, if the user chooses a different folder) owns the screen meanwhile.
    if (repoSlug && !hasFolderAccess) {
        if (!folderHandle) return null;                          // restoring the handle (brief)
        return pickerOpen ? <RepoSelector /> : <FolderAccessModal />;
    }

    // AnalysisProvider wraps both the header and the content so the header's ↻ Refresh
    // can trigger a reload from context (no prop-drilling) and the views read the results.
    return (
        <AnalysisProvider>
            <AppHeader view={view} onSelectView={setView} />
            <AppMain view={view} />
            {pickerOpen && <RepoSelector />}
        </AnalysisProvider>
    );
}
