import PickerMessages from './PickerMessages.js';
import AllReposMapped from './AllReposMapped.js';
import PickerActions from './PickerActions.js';
import styles from '../repoPicker.module.css';


export default function RepoSelector() {

    if (!isFolderPickerSupported()) {
        // No File System Access API → nothing in here can work. Show only the reason and bail.
        return (
            <div className={styles.pickerOverlay}>
                <div className={styles.picker}>
                    <p className="picker-error">
                        Your browser doesn't support the folder picker. Please use Chrome or Edge.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.pickerOverlay}>
            <div className={styles.picker}>
                <PickerMessages />
                <AllReposMapped />
                <PickerActions />
            </div>
        </div>
    );
}

function isFolderPickerSupported(): boolean {
    return typeof globalThis !== 'undefined' && 'showDirectoryPicker' in globalThis;
}