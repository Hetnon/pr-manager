import { useContext } from 'react';
import { RepoContext } from '../repo/RepoContext.js';
import LogoutButton from '../auth/LogoutButton.js';

interface Props {
    onRefresh: () => void;
}

// Right-hand repo controls: current repo, change-repo, refresh, logout. Repo
// state comes from context; App owns only the refresh behaviour. (PR-load status
// lives in the PR view, not here.)
export default function HeaderControls({ onRefresh }: Readonly<Props>) {
    const { repoSlug, setPickerOpen } = useContext(RepoContext);
    return (
        <div className="controls">
            {repoSlug && <span className="repo-display" title={repoSlug}>{repoSlug}</span>}
            {repoSlug && <button onClick={() => setPickerOpen(true)}>Change repo</button>}
            {repoSlug && <button onClick={onRefresh}>↻ Refresh</button>}
            <LogoutButton />
        </div>
    );
}
