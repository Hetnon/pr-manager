import ViewToggle, { type View } from './ViewToggle.js';
import HeaderControls from './HeaderControls.js';

export type { View };

interface Props {
    repo: string | null;
    folderHandle: FileSystemDirectoryHandle | null;
    view: View;
    status: string;
    onSelectView: (view: View) => void;
    onOpenPicker: () => void;
    onRefresh: () => void;
}

// Top bar: the Branches | Pull Requests view switch plus the repo controls.
// Pure composition — all behaviour is delegated to the callbacks App passes in.
export default function AppHeader({
    repo,
    folderHandle,
    view,
    status,
    onSelectView,
    onOpenPicker,
    onRefresh,
}: Readonly<Props>) {
    return (
        <header>
            {repo && <ViewToggle view={view} onSelectView={onSelectView} />}
            <HeaderControls
                repo={repo}
                folderHandle={folderHandle}
                status={status}
                onOpenPicker={onOpenPicker}
                onRefresh={onRefresh}
            />
        </header>
    );
}
