import { useContext } from 'react';
import { RepoContext } from '../repo/RepoContext.js';
import ViewToggle, { type View } from './ViewToggle.js';
import HeaderControls from './HeaderControls.js';

export type { View };

interface Props {
    view: View;
    setView: (view: View) => void;
}

export default function AppHeader({ view, setView }: Readonly<Props>) {
    const { currentRepoSlug } = useContext(RepoContext);
    return (
        <header>
            {currentRepoSlug && <ViewToggle view={view} onSelectView={setView} />}
            <HeaderControls />
        </header>
    );
}
