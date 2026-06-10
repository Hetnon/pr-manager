import { useContext, useState } from 'react';
import { FolderPickError, pickRepoFolder } from './pickRepoFolder.js';
import { RepoContext } from '../RepoContext.js';
import { UiGlobalContext } from '../../UiGlobal.js';
import { saveFolderHandle, saveLastOpenedRepoPointerOnStorage } from '../repoFolderStorage.js';
import styles from '../repoPicker.module.css';

export default function PickerActions() {
    const {
        currentRepoSlug, setCurrentRepoSlug,
        setCurrentRepoFolderHandle,
        setBrowserHasAcessToCurrentFolder,
        setKnownReposSlugs,
        setRepoPickerOpen,
    } = useContext(RepoContext);
    const { loading, beginLoading, endLoading } = useContext(UiGlobalContext);
    const [error, setError] = useState<string | null>(null);

    // A freshly-picked handle already has read+write granted — no need to request it.
    async function pick() {
        setError(null);
        beginLoading();
        try {
            const { handle, owner, name } = await pickRepoFolder();
            const slug = `${owner}/${name}`;
            setCurrentRepoSlug(slug);
            saveLastOpenedRepoPointerOnStorage(slug);
            setCurrentRepoFolderHandle(handle);
            setBrowserHasAcessToCurrentFolder(true);
            void saveFolderHandle(slug, handle);
            setKnownReposSlugs((known) => (known.includes(slug) ? known : [...known, slug]));
            setRepoPickerOpen(false);
        } catch (caughtError) {
            if (caughtError instanceof FolderPickError && caughtError.cancelled) return; // user dismissed the OS picker — leave the modal open with no error
            setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
        } finally {
            endLoading();
        }
    }

    return (
        <>
            <div className={styles.pickerActions}>
                {!currentRepoSlug && <button type="button" onClick={() => setRepoPickerOpen(false)}>Cancel</button>}
                <button type="button" className="primary" onClick={() => void pick()} disabled={loading}>
                    {loading ? 'Opening…' : 'Choose folder…'}
                </button>
            </div>
            {error && <p className="picker-error">{error}</p>}
        </>
    );
}
