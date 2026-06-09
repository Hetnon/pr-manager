import { useContext, useState } from 'react';
import { FolderPickError, pickRepoFolder } from './pickRepoFolder.js';
import { RepoContext } from './RepoContext.js';

// The choose-a-folder action, self-contained: opens the OS picker, sets it as the
// current repo, and closes the modal. Owns its own in-flight + error state.
export default function PickerActions() {
    const { currentRepoSlug, setRepo, setRepoPickerOpen } = useContext(RepoContext);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function pick() {
        setError(null);
        setBusy(true);
        try {
            const { handle, owner, name } = await pickRepoFolder();
            setRepo(`${owner}/${name}`, handle);
            setRepoPickerOpen(false);
        } catch (caughtError) {
            if (caughtError instanceof FolderPickError && caughtError.cancelled) {
                // User dismissed the OS picker — leave the modal open with no error.
                return;
            }
            setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <div className="picker-actions">
                {!currentRepoSlug && <button type="button" onClick={() => setRepoPickerOpen(false)}>Cancel</button>}
                <button type="button" className="primary" onClick={() => void pick()} disabled={busy}>
                    {busy ? 'Opening…' : 'Choose folder…'}
                </button>
            </div>
            {error && <p className="picker-error">{error}</p>}
        </>
    );
}
