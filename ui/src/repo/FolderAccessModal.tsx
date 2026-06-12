import { useContext } from 'react';
import { RepoContext } from './RepoContext.js';
import { UiGlobalContext } from '../UiGlobalContext.js';
import { ensureFolderWritePermission } from './folderPermission.js';
import styles from './repoPicker.module.css';


export default function FolderAccessModal() {
    // Shown on reload when a repo is remembered but the browser has dropped folder access. The user must click Grant to restore read+write before continuing
    const { 
        currentRepoSlug, 
        currentRepoFolderHandle, 
        setBrowserHasAcessToCurrentFolder, 
        setRepoPickerOpen 
    } = useContext(RepoContext);
    const { loading, beginLoading, endLoading } = useContext(UiGlobalContext);

    async function grant() {
        if (!currentRepoFolderHandle) return;
        beginLoading();
        try {
            setBrowserHasAcessToCurrentFolder(await ensureFolderWritePermission(currentRepoFolderHandle));
        } finally {
            endLoading();
        }
    }

    return (
        <div className={styles.pickerOverlay}>
            <div className={styles.picker}>
                <h2>Re-grant folder access</h2>
                <p className={styles.pickerMsg}>
                    Your browser dropped access to <code>{currentRepoSlug}</code>'s local folder when the page
                    reloaded — pages can't keep filesystem access across reloads. Click <strong>Grant access</strong>{' '}
                    to restore read &amp; write so pr-matrix can read the repo and push. Nothing loads until you do.
                </p>
                <div className={styles.pickerActions}>
                    <button type="button" onClick={() => setRepoPickerOpen(true)}>Choose a different folder</button>
                    <button type="button" className="primary" onClick={() => void grant()} disabled={loading}>
                        {loading ? 'Granting…' : 'Grant access'}
                    </button>
                </div>
            </div>
        </div>
    );
}
