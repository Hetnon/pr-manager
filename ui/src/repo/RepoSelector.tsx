import { isFolderPickerSupported } from './pickRepoFolder.js';
import PickerMessages from './PickerMessages.js';
import AllProjects from './AllProjects.js';
import PickerActions from './PickerActions.js';

// Layout shell for the repo picker modal. Each section owns its own behaviour and
// reads what it needs from context: PickerMessages (copy), AllProjects
// (switch/forget remembered projects), and PickerActions (choose a new folder).
export default function RepoSelector() {
    // No File System Access API → nothing in here works (no picking, and no
    // remembered projects can exist without it). Show only the reason and bail.
    if (!isFolderPickerSupported()) {
        return (
            <div className="picker-overlay">
                <div className="picker">
                    <p className="picker-error">
                        Your browser doesn't support the folder picker. Please use Chrome or Edge.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="picker-overlay">
            <div className="picker">
                <PickerMessages />
                <AllProjects />
                <PickerActions />
            </div>
        </div>
    );
}
