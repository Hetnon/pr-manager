// View-agnostic file-overlap primitives shared by the PR matrix and the local
// branches conflict check. Both views answer the same underlying question —
// "which files are touched by more than one change-set?" — over different
// inputs (open PRs vs. local branch diffs). The PR side stops at presence
// overlap (conflict *risk*); the branches side feeds these results into a
// deeper 3-way line-level merge. Only the overlap kernel lives here.

// A unit of change identified by `id`, touching the files in `files`.
// Id is generic: PR numbers on the PR side, branch names on the branches side.
export interface ChangeSet<Id> {
    id: Id;
    files: string[];
}

// Maps each file path to the ids of every change-set that touches it, preserving
// the order change-sets were supplied. A path with more than one id is "hot" —
// shared by multiple change-sets and therefore a conflict risk.
export function mapFilesToChangeSets<Id>(changeSets: ChangeSet<Id>[]): Map<string, Id[]> {
    const fileToIds = new Map<string, Id[]>();
    for (const changeSet of changeSets) {
        for (const path of changeSet.files) {
            let ids = fileToIds.get(path);
            if (!ids) {
                ids = [];
                fileToIds.set(path, ids);
            }
            ids.push(changeSet.id);
        }
    }
    return fileToIds;
}

export interface OverlapPair<Id> {
    a: Id;
    b: Id;
    intersection: string[];
}

// Every pair of change-sets that share at least one file, sorted by overlap size
// (largest first). Change-sets with no files contribute no pairs.
export function pairwiseFileOverlap<Id>(changeSets: ChangeSet<Id>[]): OverlapPair<Id>[] {
    const pairs: OverlapPair<Id>[] = [];
    for (let i = 0; i < changeSets.length; i++) {
        const first = changeSets[i];
        if (first.files.length === 0) continue;
        const firstFiles = new Set(first.files);
        for (let j = i + 1; j < changeSets.length; j++) {
            const second = changeSets[j];
            if (second.files.length === 0) continue;
            const intersection = second.files.filter((path) => firstFiles.has(path));
            if (intersection.length > 0) pairs.push({ a: first.id, b: second.id, intersection });
        }
    }
    pairs.sort((pairA, pairB) => pairB.intersection.length - pairA.intersection.length);
    return pairs;
}
