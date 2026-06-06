import { useContext } from 'react';
import { RepoContext } from '../repo/RepoContext.js';
import ViewToggle, { type View } from './ViewToggle.js';
import HeaderControls from './HeaderControls.js';

export type { View };

interface Props {
    view: View;
    onSelectView: (view: View) => void;
    onRefresh: () => void;
}

// Top bar: the Branches | Pull Requests view switch plus the repo controls.
// Pure composition — the view switch is gated on having a repo (read from
// context); all behaviour is delegated to the callbacks App passes in.
export default function AppHeader({ view, onSelectView, onRefresh }: Readonly<Props>) {
    const { repo } = useContext(RepoContext);
    return (
        <header>
            {repo && <ViewToggle view={view} onSelectView={onSelectView} />}
            <HeaderControls onRefresh={onRefresh} />
        </header>
    );
}
