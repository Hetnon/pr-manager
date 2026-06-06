import { useContext } from 'react';
import { RepoContext } from '../repo/RepoContext.js';
import RepoPermissionBadge from '../repo/RepoPermissionBadge.js';
import LogoutButton from '../auth/LogoutButton.js';

interface Props {
    onRefresh: () => void;
}

// Right-hand repo controls: current repo, permission badge, change-repo,
// refresh, logout. Repo state comes from context; App owns only the refresh
// behaviour. (PR-load status lives in the PR view, not here.)
export default function HeaderControls({ onRefresh }: Readonly<Props>) {
    const { repo, folderHandle, openPicker } = useContext(RepoContext);
    return (
        <div className="controls">
            {repo && <span className="repo-display" title={repo}>{repo}</span>}
            {repo && folderHandle && (
                <RepoPermissionBadge
                    handle={folderHandle}
                    onChange={(level) => { if (level === 'readwrite') onRefresh(); }}
                />
            )}
            {repo && <button onClick={openPicker}>Change repo</button>}
            {repo && <button onClick={onRefresh}>↻ Refresh</button>}
            <LogoutButton />
        </div>
    );
}
