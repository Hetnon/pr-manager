import type { DedupGroup } from './dedupGroups.js';
import styles from './DedupPanel.module.css';

interface Props {
    group: DedupGroup;
    radioName: string;
    keeper: string;
    included: boolean;
    expanded: boolean;
    disabled: boolean;
    onToggleInclude: () => void;
    onToggleExpand: () => void;
    onSetKeeper: (branch: string) => void;
}

export default function DedupGroupRow({
    group, radioName, keeper, included, expanded, disabled,
    onToggleInclude, onToggleExpand, onSetKeeper,
}: Readonly<Props>) {
    return (
        <li className={styles.row}>
            <div className={styles.rowHead}>
                <label className={styles.includeLabel}>
                    <input
                        type="checkbox"
                        checked={included}
                        disabled={disabled}
                        onChange={onToggleInclude}
                        className={styles.includeCheckbox}
                    />
                    <span><strong>{group.files.length}</strong> file(s) identical across {group.branches.length} branches</span>
                </label>
                <button type="button" className={styles.showFiles} onClick={onToggleExpand}>
                    {expanded ? 'hide' : 'show'} files
                </button>
            </div>

            <div className={styles.keepRow}>
                Keep in:
                {group.branches.map((branch) => (
                    <label key={branch} className={styles.keepOption}>
                        <input
                            type="radio"
                            name={radioName}
                            checked={keeper === branch}
                            disabled={disabled || !included}
                            onChange={() => onSetKeeper(branch)}
                        />
                        <code>{branch}</code>
                    </label>
                ))}
            </div>

            {expanded && (
                <ul className={styles.fileList}>
                    {group.files.map((file) => <li key={file}>{file}</li>)}
                </ul>
            )}
        </li>
    );
}
