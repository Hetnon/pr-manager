import { useContext } from 'react';
import { RepoContext } from '../repo/RepoContext.js';
import { AnalysisContext } from '../analysis/AnalysisContext.js';
import LogoutButton from '../auth/LogoutButton.js';

// Right-hand controls: current repo, change-repo, refresh,  Repo state
// and the refresh trigger both come from context. (PR-load status lives in the PR
// view, not here.) Logout from The app
export default function HeaderControls() {
    const { repoSlug, setPickerOpen } = useContext(RepoContext);
    const { triggerRefresh } = useContext(AnalysisContext);
    return (
        <div className="controls">
            {repoSlug && <span className="repo-display" title={repoSlug}>{repoSlug}</span>}
            {repoSlug && <button onClick={() => setPickerOpen(true)}>Change repo</button>}
            {repoSlug && <button onClick={triggerRefresh}>↻ Refresh</button>}
            <LogoutButton />
        </div>
    );
}
