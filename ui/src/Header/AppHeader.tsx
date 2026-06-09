import { useContext } from 'react';
import { RepoContext } from '../repo/RepoContext.js';
import ViewToggle, { type View } from './ViewToggle.js';
import HeaderControls from './HeaderControls.js';

export type { View };

interface Props {
    view: View;
    onSelectView: (view: View) => void;
}

// Top bar: the Branches | Pull Requests view switch plus the repo controls.
// Pure composition — the view switch is gated on having a repo (read from
// context); the controls read what they need (repo, refresh) from context too.
export default function AppHeader({ view, onSelectView }: Readonly<Props>) {
    const { currentRepoSlug } = useContext(RepoContext);
    return (
        <header>
            {currentRepoSlug && <ViewToggle view={view} onSelectView={onSelectView} />}
            <HeaderControls />
        </header>
    );
}
