import { useState } from 'react';
import { FolderPickError, isFolderPickerSupported, pickRepoFolder } from './pickRepoFolder.js';

export interface RepoSelectorProps {
    currentRepo: string | null;
    onSelect: (ownerRepo: string, handle: FileSystemDirectoryHandle) => void;
    onCancel?: () => void;
    firstRun?: boolean;
}

export default function RepoSelector({ currentRepo, onSelect, onCancel, firstRun }: RepoSelectorProps) {
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const supported = isFolderPickerSupported();

    async function pick() {
        setError(null);
        setBusy(true);
        try {
            const { handle, owner, name } = await pickRepoFolder();
            onSelect(`${owner}/${name}`, handle);
        } catch (e) {
            if (e instanceof FolderPickError && e.cancelled) {
                // User dismissed the OS picker — leave the modal open with no error.
                return;
            }
            setError(e instanceof Error ? e.message : String(e));
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
                    {!firstRun && onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
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
