import { useContext } from 'react';
import { RepoContext } from '../repo/RepoContext.js';
import { AnalysisContext } from '../views/AnalysisContext.js';
import LogoutButton from './LogoutButton.js';
import styles from './Header.module.css';

// Right-hand controls: current repo, change-repo, refresh,  Repo state
// and the refresh trigger both come from context. (PR-load status lives in the PR
// view, not here.) Logout from The app
export default function HeaderControls() {
    const { currentRepoSlug, setRepoPickerOpen } = useContext(RepoContext);
    const { refreshRepo } = useContext(AnalysisContext);
    return (
        <div className={styles.controls}>
            {currentRepoSlug && <span className={styles.repoDisplay} title={currentRepoSlug}>{currentRepoSlug}</span>}
            {currentRepoSlug && <button onClick={() => setRepoPickerOpen(true)}>Change repo</button>}
            {currentRepoSlug && <button onClick={refreshRepo}>↻ Refresh</button>}
            <LogoutButton />
        </div>
    );
}
