import { useContext, useMemo, useState } from 'react';
import type { LocalConflictReport } from '../../../checkLocalConflicts.js';
import { RepoContext } from '../../../../../repo/RepoContext.js';
import { loadJson, saveJson } from '../../../../../lib/localStorage.js';
import { buildDedupGroups, type DedupGroup } from './dedupGroups.js';
import { collapseKeptDuplicates } from './collapseKeptDuplicates.js';

export const dedupGroupKey = (group: DedupGroup) => group.branches.join('\n');
const defaultKeeper = (group: DedupGroup) => group.branches[group.branches.length - 1];

interface PersistedChoices {
    excluded: string[];              // group keys the user chose NOT to collapse
    keepers: [string, string][];     // group key → branch that keeps the files
}

const dedupStorageKey = (slug: string) => `pr-matrix.dedup.${slug}`;
function loadChoices(slug: string | null): PersistedChoices {
    if (!slug) return { excluded: [], keepers: [] };
    return loadJson<PersistedChoices>(dedupStorageKey(slug)) ?? { excluded: [], keepers: [] };
}
function saveChoices(slug: string | null, choices: PersistedChoices): void {
    if (slug) saveJson(dedupStorageKey(slug), choices);
}

export interface DedupChoices {
    groups: DedupGroup[];
    keeperFor: (group: DedupGroup) => string;
    isIncluded: (group: DedupGroup) => boolean;
    toggleIncluded: (key: string) => void;
    setKeeper: (key: string, branch: string) => void;
    effectiveReport: LocalConflictReport;
}

// Owns the "collapse identical files" choices as pure view state and derives the
// effective report the matrix and downstream funnel render. Choices persist per repo.
export function useDedupChoices(rawReport: LocalConflictReport): DedupChoices {
    const { currentRepoSlug } = useContext(RepoContext);
    const groups = useMemo(() => buildDedupGroups(rawReport.fileDetail), [rawReport.fileDetail]);

    const [choices, setChoices] = useState<PersistedChoices>(() => loadChoices(currentRepoSlug));
    const excluded = useMemo(() => new Set(choices.excluded), [choices]);
    const keepers = useMemo(() => new Map(choices.keepers), [choices]);

    const commit = (next: PersistedChoices) => { setChoices(next); saveChoices(currentRepoSlug, next); };
    const toggleIncluded = (key: string) => {
        const next = new Set(excluded);
        if (next.has(key)) next.delete(key); else next.add(key);
        commit({ excluded: [...next], keepers: [...keepers] });
    };
    const setKeeper = (key: string, branch: string) => {
        const next = new Map(keepers); next.set(key, branch);
        commit({ excluded: [...excluded], keepers: [...next] });
    };

    const keeperFor = (group: DedupGroup) => keepers.get(dedupGroupKey(group)) ?? defaultKeeper(group);
    const isIncluded = (group: DedupGroup) => !excluded.has(dedupGroupKey(group));

    const filesByDonor = useMemo(() => {
        const byDonor = new Map<string, Set<string>>();
        for (const group of groups) {
            if (excluded.has(dedupGroupKey(group))) continue;
            const keeper = keepers.get(dedupGroupKey(group)) ?? defaultKeeper(group);
            for (const donor of group.branches) {
                if (donor === keeper) continue;
                let files = byDonor.get(donor);
                if (!files) { files = new Set(); byDonor.set(donor, files); }
                for (const file of group.files) files.add(file);
            }
        }
        return byDonor;
    }, [groups, excluded, keepers]);

    const effectiveReport: LocalConflictReport = useMemo(
        () => (filesByDonor.size === 0 ? rawReport : collapseKeptDuplicates(rawReport, filesByDonor)),
        [rawReport, filesByDonor],
    );

    return { groups, keeperFor, isIncluded, toggleIncluded, setKeeper, effectiveReport };
}
