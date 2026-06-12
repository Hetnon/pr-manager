import * as git from 'isomorphic-git';
import { merge as diff3Merge } from 'node-diff3';
import type { PR } from '@shared/pr.js';
import type { FileSeverity, PrGroup, PairwisePrConflicts } from '@shared/conflicts.js';
import { makeFsApiFs } from '../../../adapters/fsApiAdapter.js';

type Fs = ReturnType<typeof makeFsApiFs>;

// Real 3-way merge-based pairwise PR conflict detection. Replaces the
// line-range heuristic that lived server-side. Requires the PR HEAD commits to
// already be in the local object database — call fetchPrRefs first.
//
// For each multi-touch file:
//   - Find the merge-base of the two PRs' HEADs (their common ancestor)
//   - Read the file's blob at base, PR A HEAD, PR B HEAD
//   - Run node-diff3's `merge` — the diff3 algorithm git uses internally for
//     textual 3-way merge
//   - conflict: false → mergeable
//   - conflict: true  → real conflict (red)
//
// isomorphic-git's own merge() can't do this — it only handles fast-forward
// and throws MergeNotSupportedError otherwise. mergeFile isn't a public
// export. So we use node-diff3 directly for the file content.
//
// Files we can't analyze (binary, missing on a side, errored read) stay at the
// conservative 'warning' default.
export async function computeBrowserPairwise(
    handle: FileSystemDirectoryHandle,
    prs: PR[],
): Promise<PairwisePrConflicts> {
    const fs = makeFsApiFs(handle);
    const dir = '/';

    const bySha = new Map<string, number[]>();
    for (const pr of prs) {
        if (!bySha.has(pr.headSha)) bySha.set(pr.headSha, []);
        bySha.get(pr.headSha)!.push(pr.number);
    }
    const prGroups: PrGroup[] = [];
    for (const [sha, prNumbers] of bySha) {
        const sorted = [...prNumbers].sort((numberA, numberB) => numberA - numberB);
        prGroups.push({ sha, prNumbers: sorted, canonical: sorted[0] });
    }
    prGroups.sort((groupA, groupB) => groupA.canonical - groupB.canonical);

    const canonicalNums = new Set(prGroups.map((group) => group.canonical));
    const canonicals = prs.filter((pr) => canonicalNums.has(pr.number));

    const fileToPrs = new Map<string, PR[]>();
    for (const pr of canonicals) {
        for (const file of pr.files) {
            if (!fileToPrs.has(file.path)) fileToPrs.set(file.path, []);
            fileToPrs.get(file.path)!.push(pr);
        }
    }

    const fileSeverity: Record<string, FileSeverity> = {};
    for (const [file, touchedBy] of fileToPrs) {
        if (touchedBy.length === 1) { fileSeverity[file] = 'safe'; continue; }
        let severity: FileSeverity = 'warning';
        outer: for (let i = 0; i < touchedBy.length; i++) {
            for (let j = i + 1; j < touchedBy.length; j++) {
                const verdict = await pairVerdict(fs, dir, touchedBy[i], touchedBy[j], file);
                if (verdict === 'conflict') { severity = 'conflict'; break outer; }
            }
        }
        fileSeverity[file] = severity;
    }

    return { prGroups, fileSeverity };
}

async function pairVerdict(
    fs: Fs, dir: string,
    prA: PR, prB: PR,
    filepath: string,
): Promise<'clean' | 'conflict' | 'unknown'> {
    try {
        const bases = await git.findMergeBase({ fs, dir, oids: [prA.headSha, prB.headSha] });
        const baseOid = bases[0];
        if (!baseOid) return 'unknown';

        const baseText = await tryReadText(fs, dir, baseOid, filepath);
        const ourText = await tryReadText(fs, dir, prA.headSha, filepath);
        const theirText = await tryReadText(fs, dir, prB.headSha, filepath);

        // mergeFile semantics aren't well-defined when one side is binary or
        // missing — bail out conservatively.
        if (baseText === undefined || ourText === undefined || theirText === undefined) return 'unknown';

        const result = diff3Merge(ourText, baseText, theirText, { stringSeparator: /\r?\n/ });
        return result.conflict ? 'conflict' : 'clean';
    } catch {
        return 'unknown';
    }
}

async function tryReadText(fs: Fs, dir: string, commitOid: string, filepath: string): Promise<string | undefined> {
    try {
        const { blob } = await git.readBlob({ fs, dir, oid: commitOid, filepath });
        const limit = Math.min(blob.length, 8192);
        for (let i = 0; i < limit; i++) {
            if (blob[i] === 0) return undefined; // binary
        }
        return new TextDecoder('utf-8', { fatal: false }).decode(blob);
    } catch {
        return undefined;
    }
}
