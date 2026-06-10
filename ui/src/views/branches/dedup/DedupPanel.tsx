import { useContext, useMemo, useState } from 'react';
import type { LocalConflictReport } from '../checkLocalConflicts.js';
import { buildDedupGroups, type DedupGroup } from './dedupGroups.js';
import { RepoContext } from '../../../repo/RepoContext.js';
import { useDedup } from './useDedup.js';
import DedupGroupRow from './DedupGroupRow.js';
import styles from './DedupPanel.module.css';
import branchStyles from '../BranchesView.module.css';

interface Props {
    conflictReport: LocalConflictReport;
    setConflictReport: React.Dispatch<React.SetStateAction<LocalConflictReport | null>>;
}

const groupKey = (group: DedupGroup) => group.branches.join('\n');
const defaultKeeper = (group: DedupGroup) => group.branches[group.branches.length - 1];

export default function DedupPanel({ conflictReport, setConflictReport }: Readonly<Props>) {
    const { currentRepoFolderHandle } = useContext(RepoContext);
    const { dedupBusy, lastDedup, applyDedup } = useDedup(currentRepoFolderHandle, conflictReport, setConflictReport);

    const groups = useMemo(() => buildDedupGroups(conflictReport.fileDetail), [conflictReport.fileDetail]);

    const [panelOpen, setPanelOpen] = useState(false);
    const [includedGroups, setIncludedGroups] = useState<Set<string>>(() => new Set(groups.map(groupKey)));
    const [keeperByGroup, setKeeperByGroup] = useState<Map<string, string>>(
        () => new Map(groups.map((group) => [groupKey(group), defaultKeeper(group)])),
    );
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    if (groups.length === 0 && !lastDedup) return null;

    const totalDuplicateFiles = new Set(groups.flatMap((group) => group.files)).size;
    const keeperFor = (group: DedupGroup) => keeperByGroup.get(groupKey(group)) ?? defaultKeeper(group);

    // Each included group keeps its files in the chosen branch and drops them from the
    // others — so every non-keeper branch becomes a donor that sheds those files.
    const filesByDonor = new Map<string, Set<string>>();
    for (const group of groups) {
        if (!includedGroups.has(groupKey(group))) continue;
        const keeper = keeperFor(group);
        for (const donor of group.branches) {
            if (donor === keeper) continue;
            let files = filesByDonor.get(donor);
            if (!files) { files = new Set(); filesByDonor.set(donor, files); }
            for (const file of group.files) files.add(file);
        }
    }
    const includedCount = groups.filter((group) => includedGroups.has(groupKey(group))).length;

    const toggle = (set: Set<string>, setter: (next: Set<string>) => void, key: string) => {
        const next = new Set(set);
        if (next.has(key)) next.delete(key); else next.add(key);
        setter(next);
    };

    return (
        <>
            {groups.length > 0 && (
                <div className={styles.card}>
                    <button type="button" onClick={() => setPanelOpen((open) => !open)} className={styles.toggle}>
                        <span className={styles.caret}>{panelOpen ? '▼' : '▶'}</span>
                        Reduce redundancy — {totalDuplicateFiles} identical file(s) across {groups.length} group(s)
                    </button>

                    {panelOpen && (
                        <div className={styles.body}>
                            <p className={styles.intro}>
                                Each group's files are byte-identical across several branches. Pick the branch to <strong>keep</strong> them
                                in; they're dropped from the others via a <code>‹branch›-dedup</code> copy with those files reverted to the
                                merge-base. Originals are left untouched.
                            </p>

                            <ul className={styles.list}>
                                {groups.map((group, index) => {
                                    const key = groupKey(group);
                                    return (
                                        <DedupGroupRow
                                            key={key}
                                            group={group}
                                            radioName={`keep-${index}`}
                                            keeper={keeperFor(group)}
                                            included={includedGroups.has(key)}
                                            expanded={expandedGroups.has(key)}
                                            disabled={dedupBusy}
                                            onToggleInclude={() => toggle(includedGroups, setIncludedGroups, key)}
                                            onToggleExpand={() => toggle(expandedGroups, setExpandedGroups, key)}
                                            onSetKeeper={(branch) => setKeeperByGroup((prev) => new Map(prev).set(key, branch))}
                                        />
                                    );
                                })}
                            </ul>

                            <button
                                type="button"
                                className={`primary ${styles.apply}`}
                                onClick={() => applyDedup(filesByDonor)}
                                disabled={dedupBusy || filesByDonor.size === 0}
                            >
                                {dedupBusy
                                    ? 'Creating dedup branches…'
                                    : `Create ${filesByDonor.size} dedup branch(es) from ${includedCount} group(s)`}
                            </button>
                        </div>
                    )}
                </div>
            )}
            {lastDedup && (
                <p className={`${styles.message} ${lastDedup.ok ? branchStyles.ok : branchStyles.bad}`}>
                    {lastDedup.ok ? '✓ ' : '✗ '}{lastDedup.message}
                </p>
            )}
        </>
    );
}
