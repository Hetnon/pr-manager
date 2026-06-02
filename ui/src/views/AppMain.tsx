import type { PR } from '@shared/pr.js';
import BranchesView from './views/branches/BranchesView.js';
import PrView from './views/pr/PrView.js';
import type { View } from './Header/AppHeader.js';

interface Props {
    view: View;
    prs: PR[] | null;
    parsed: { owner: string; name: string } | null;
    folderHandle: FileSystemDirectoryHandle | null;
    contentError: string | null;
    initialized: boolean;
    refreshNonce: number;
    onPushed: () => void;
    onMerged: () => void;
}

// The content area. A hard toggle: exactly one of the two views renders.
// Branches is local work (anyone's machine); Pull Requests is remote work a
// tech lead reviews and merges. The shared `prs` fetch lives in App, so both
// views read the same data and switching never refetches.
export default function AppMain({
    view,
    prs,
    parsed,
    folderHandle,
    contentError,
    initialized,
    refreshNonce,
    onPushed,
    onMerged,
}: Readonly<Props>) {
    return (
        <main>
            {view === 'branches' && (
                <BranchesView
                    handle={folderHandle}
                    prs={prs}
                    owner={parsed?.owner ?? null}
                    repo={parsed?.name ?? null}
                    refreshNonce={refreshNonce}
                    onPushed={onPushed}
                />
            )}
            {view === 'prs' && (
                <>
                    {contentError && <p className="error">{contentError}</p>}
                    {!contentError && parsed && prs === null && <p className="loading">{initialized ? 'Loading PRs…' : 'Loading…'}</p>}
                    {!contentError && parsed && Array.isArray(prs) && (
                        <PrView prs={prs} owner={parsed.owner} repo={parsed.name} folderHandle={folderHandle} onMerged={onMerged} />
                    )}
                </>
            )}
        </main>
    );
}
