import { useState } from 'react';
import type { DedupGroup } from './dedupGroups.js';
import { dedupGroupKey } from './useDedupChoices.js';
import DedupGroupRow from './DedupGroupRow.js';
import styles from './DedupPanel.module.css';

interface Props {
    groups: DedupGroup[];
    keeperFor: (group: DedupGroup) => string;
    isIncluded: (group: DedupGroup) => boolean;
    toggleIncluded: (key: string) => void;
    setKeeper: (key: string, branch: string) => void;
}

// Controls which identical-file groups are collapsed out of the matrix and which branch
// each is shown under. Pure view state (from useDedupChoices) — no git, nothing applied.
export default function DedupPanel({ groups, keeperFor, isIncluded, toggleIncluded, setKeeper }: Readonly<Props>) {
    const [panelOpen, setPanelOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    if (groups.length === 0) return null;

    const totalDuplicateFiles = new Set(groups.flatMap((group) => group.files)).size;
    const collapsedCount = groups.filter(isIncluded).length;

    const toggleExpanded = (key: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    return (
        <div className={styles.card}>
            <button type="button" onClick={() => setPanelOpen((open) => !open)} className={styles.toggle}>
                <span className={styles.caret}>{panelOpen ? '▼' : '▶'}</span>
                Redundant files collapsed — {collapsedCount} of {groups.length} group(s), {totalDuplicateFiles} identical file(s) hidden
            </button>
            {panelOpen && (
                <div className={styles.body}>
                    <p className={styles.intro}>
                        Files byte-identical across several branches are hidden from the matrix to cut noise — they merge
                        cleanly, so there's nothing to resolve. Pick the branch each group is shown under, or untick a group
                        to show it again. Nothing is changed in git.
                    </p>
                    <ul className={styles.list}>
                        {groups.map((group, index) => {
                            const key = dedupGroupKey(group);
                            return (
                                <DedupGroupRow
                                    key={key}
                                    group={group}
                                    radioName={`keep-${index}`}
                                    keeper={keeperFor(group)}
                                    included={isIncluded(group)}
                                    expanded={expandedGroups.has(key)}
                                    disabled={false}
                                    onToggleInclude={() => toggleIncluded(key)}
                                    onToggleExpand={() => toggleExpanded(key)}
                                    onSetKeeper={(branch) => setKeeper(key, branch)}
                                />
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
