import RepoPermissionBadge from '../repo/RepoPermissionBadge.js';
import LogoutButton from '../auth/LogoutButton.js';

interface Props {
    repo: string | null;
    folderHandle: FileSystemDirectoryHandle | null;
    status: string;
    onOpenPicker: () => void;
    onRefresh: () => void;
}

// Right-hand repo controls: current repo, permission badge, change-repo,
// refresh, status text, logout. Pure presentation — App owns the behaviour.
export default function HeaderControls({
    repo,
    folderHandle,
    status,
    onOpenPicker,
    onRefresh,
}: Readonly<Props>) {
    return (
        <div className="controls">
            {repo && <span className="repo-display" title={repo}>{repo}</span>}
            {repo && folderHandle && (
                <RepoPermissionBadge
                    handle={folderHandle}
                    onChange={(level) => { if (level === 'readwrite') onRefresh(); }}
                />
            )}
            {repo && <button onClick={onOpenPicker}>Change repo</button>}
            {repo && <button onClick={onRefresh}>↻ Refresh</button>}
            <span id="status">{status}</span>
            <LogoutButton />
        </div>
    );
}
