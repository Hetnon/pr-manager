import { useContext } from 'react';
import { RepoContext } from '../RepoContext.js';
import styles from '../repoPicker.module.css';

// The picker's static copy: title, what to choose, and the current repo.
export default function PickerMessages() {
    const { currentRepoSlug } = useContext(RepoContext);
    return (
        <>
            <h2>{currentRepoSlug ? 'Change repository folder' : 'Pick a repository folder'}</h2>
            <p className={styles.pickerMsg}>
                Choose a local folder containing a git repository with a GitHub remote.
                {' '}You need at least read access on GitHub; merging requires push access.
            </p>
            {currentRepoSlug && (
                <p className={styles.pickerMsg}>Current: <code>{currentRepoSlug}</code></p>
            )}
        </>
    );
}
