import { useContext, useState } from 'react';
import { FolderPickError, isFolderPickerSupported, pickRepoFolder } from './pickRepoFolder.js';
import { RepoContext } from './RepoContext.js';

export default function RepoSelector() {
    const { repo: currentRepo, setRepo, closePicker } = useContext(RepoContext);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const supported = isFolderPickerSupported();
    const firstRun = !currentRepo;

    // Select the picked folder as the current repo and close the picker — the
    // whole "choose a repo" interaction is owned here, not by App.
    async function pick() {
        setError(null);
        setBusy(true);
        try {
            const { handle, owner, name } = await pickRepoFolder();
            setRepo(`${owner}/${name}`, handle);
            closePicker();
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
        <div className="picker-overlay">
            <div className="picker">
                <h2>{firstRun ? 'Pick a repository folder' : 'Change repository folder'}</h2>
                <p className="picker-msg">
                    Choose a local folder containing a git repository with a GitHub remote.
                    {' '}You need at least read access on GitHub; merging requires push access.
                </p>
                {currentRepo && (
                    <p className="picker-msg">Current: <code>{currentRepo}</code></p>
                )}
                <div className="picker-actions">
                    {!firstRun && <button type="button" onClick={closePicker}>Cancel</button>}
                    <button type="button" className="primary" onClick={pick} disabled={!supported || busy}>
                        {busy ? 'Opening…' : 'Choose folder…'}
                    </button>
                </div>
                {!supported && (
                    <p className="picker-error">
                        Your browser doesn't support the folder picker. Please use Chrome or Edge.
                    </p>
                )}
                {error && <p className="picker-error">{error}</p>}
            </div>
        </div>
    );
}
