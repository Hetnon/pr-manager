import { useContext, useState } from 'react';
import { RepoContext } from './RepoContext.js';
import { requestFolderReadWrite } from './folderPermission.js';

// Shown full-screen on reload when a repo is remembered but the browser has
// dropped folder access (it does this on every reload, as a security rule). The
// app body stays unmounted behind it, so nothing runs without access. The user
// must click Grant to restore read+write before continuing.
export default function FolderAccessModal() {
    const { repoSlug, folderHandle, setHasFolderAccess, setPickerOpen } = useContext(RepoContext);
    const [busy, setBusy] = useState(false);

    // Re-grant read+write to the current folder — must run from this click (a user
    // gesture); requestPermission throws otherwise. Owned here since this is the
    // only place that grants.
    async function grant() {
        if (!folderHandle) return;
        setBusy(true);
        try {
            const level = await requestFolderReadWrite(folderHandle);
            setHasFolderAccess(level === 'readwrite');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="picker-overlay">
            <div className="picker">
                <h2>Re-grant folder access</h2>
                <p className="picker-msg">
                    Your browser dropped access to <code>{repoSlug}</code>'s local folder when the page
                    reloaded — pages can't keep filesystem access across reloads. Click <strong>Grant access</strong>{' '}
                    to restore read &amp; write so pr-matrix can read the repo and push. Nothing loads until you do.
                </p>
                <div className="picker-actions">
                    <button type="button" onClick={() => setPickerOpen(true)}>Choose a different folder</button>
                    <button type="button" className="primary" onClick={() => void grant()} disabled={busy}>
                        {busy ? 'Granting…' : 'Grant access'}
                    </button>
                </div>
            </div>
        </div>
    );
}
