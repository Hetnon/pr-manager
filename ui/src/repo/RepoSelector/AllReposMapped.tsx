import { useContext } from 'react';
import { RepoContext } from '../RepoContext.js';
import { UiGlobalContext } from '../../UiGlobalContext.js';
import { clearFolderHandle, loadFolderHandle, saveLastOpenedRepoPointerOnStorage } from '../repoFolderStorage.js';
import { ensureFolderWritePermission } from '../folderPermission.js';
import styles from '../repoPicker.module.css';

export default function AllReposMapped() {
    // The other remembered projects, self-contained: click a row to switch to it, × to forget it. 
    const {
        currentRepoSlug,
        knownReposSlugs,
        setCurrentRepoSlug,
        setCurrentRepoFolderHandle,
        setKnownReposSlugs,
        setBrowserHasAcessToCurrentFolder,
        setRepoPickerOpen,
    } = useContext(RepoContext);
    const { loading, beginLoading, endLoading } = useContext(UiGlobalContext);
    const otherProjects = knownReposSlugs.filter((slug) => slug !== currentRepoSlug);

    if (otherProjects.length === 0) return null;

    async function switchTo(slug: string) {
        // Switch to an already-remembered project without re-opening the OS picker.
        beginLoading();
        try {
            const handle = await loadFolderHandle(slug);
            if(!handle) {
                throw new Error('Failed to load folder handle');
            }
            const granted = await ensureFolderWritePermission(handle); // handle has lost folder permission, so we re-grant it here
            setCurrentRepoSlug(slug);
            saveLastOpenedRepoPointerOnStorage(slug);
            setCurrentRepoFolderHandle(handle);
            setBrowserHasAcessToCurrentFolder(granted);
            setRepoPickerOpen(false);
        } finally {
            endLoading();
        }
    }

    // Drop a remembered project's stored handle; clear the selection if it was active.
    async function forget(slug: string) {
        await clearFolderHandle(slug);
        setKnownReposSlugs((known) => known.filter((remembered) => remembered !== slug));
        if (slug === currentRepoSlug) {
            setCurrentRepoSlug(null);
            saveLastOpenedRepoPointerOnStorage(null);
            setCurrentRepoFolderHandle(null);
            setBrowserHasAcessToCurrentFolder(false);
        }
    }

    return (
        <div className={styles.pickerKnown}>
            <p className={styles.pickerMsg}>Switch to a remembered project:</p>
            <ul className={styles.pickerKnownList}>
                {otherProjects.map((slug) => (
                    <li key={slug} className={styles.pickerKnownItem}>
                        <button
                            type="button"
                            className={styles.pickerKnownSwitch}
                            disabled={loading}
                            onClick={() => void switchTo(slug)}
                        >
                            <code>{slug}</code>
                        </button>
                        <button
                            type="button"
                            className={styles.pickerKnownForget}
                            title={`Forget ${slug}`}
                            aria-label={`Forget ${slug}`}
                            disabled={loading}
                            onClick={() => void forget(slug)}
                        >×</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
