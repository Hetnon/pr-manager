// ARCHIVED — superseded by browser-side pairwise via isomorphic-git mergeFile.
// Outside server/ include path so it won't compile or be imported. Kept for
// reference / quick revert if the local-git path runs into a blocker.
//
// What this did: server-side pairwise PR conflict detection using GitHub patch
// strings and line-range overlap heuristic. Conservative — produced false
// positives for hunks that overlapped in line range but didn't actually
// conflict under git's 3-way merge.

import { Octokit } from '@octokit/rest';
import type { FileSeverity, PrGroup, PairwisePrConflicts } from '@shared/conflicts.js';

interface BaseHunk { baseStart: number; baseLines: number; }

interface PrFileData {
    number: number;
    sha: string;
    // patch === null when GitHub omits the diff (binary, file too large, etc.)
    files: { path: string; patch: string | null }[];
}

/**
 * For a set of PRs, computes:
 *   - prGroups: PRs grouped by head sha (duplicate detection)
 *   - fileSeverity: per-file pairwise overlap between canonical PRs
 *
 * Pure GitHub-API based — uses `pulls.listFiles` `patch` strings to extract
 * hunks. No blob reads needed.
 */
export async function pairwisePrConflicts(
    owner: string,
    repo: string,
    prNumbers: number[],
    token: string,
): Promise<PairwisePrConflicts> {
    if (prNumbers.length === 0) return { prGroups: [], fileSeverity: {} };

    const octokit = new Octokit({ auth: token });
    const prData = await Promise.all(prNumbers.map(async (n) => fetchPrData(octokit, owner, repo, n)));

    const bySha = new Map<string, number[]>();
    for (const p of prData) {
        if (!bySha.has(p.sha)) bySha.set(p.sha, []);
        bySha.get(p.sha)!.push(p.number);
    }
    const prGroups: PrGroup[] = [];
    for (const [sha, nums] of bySha) {
        const sorted = [...nums].sort((a, b) => a - b);
        prGroups.push({ sha, prNumbers: sorted, canonical: sorted[0] });
    }
    prGroups.sort((a, b) => a.canonical - b.canonical);

    const canonicalSet = new Set(prGroups.map((g) => g.canonical));
    const canonicals = prData.filter((p) => canonicalSet.has(p.number));

    const fileToPrs = new Map<string, number[]>();
    for (const p of canonicals) {
        for (const f of p.files) {
            if (!fileToPrs.has(f.path)) fileToPrs.set(f.path, []);
            fileToPrs.get(f.path)!.push(p.number);
        }
    }

    const hunksByPrFile = new Map<number, Map<string, BaseHunk[]>>();
    for (const p of canonicals) {
        const m = new Map<string, BaseHunk[]>();
        for (const f of p.files) {
            if (f.patch === null) continue;
            m.set(f.path, parseHunks(f.patch));
        }
        hunksByPrFile.set(p.number, m);
    }

    const fileSeverity: Record<string, FileSeverity> = {};
    for (const [file, prs] of fileToPrs) {
        if (prs.length === 1) { fileSeverity[file] = 'safe'; continue; }
        let severity: FileSeverity = 'warning';
        outer: for (let i = 0; i < prs.length; i++) {
            const hi = hunksByPrFile.get(prs[i])?.get(file);
            for (let j = i + 1; j < prs.length; j++) {
                const hj = hunksByPrFile.get(prs[j])?.get(file);
                if (!hi || !hj) continue;
                if (hunksOverlap(hi, hj)) { severity = 'conflict'; break outer; }
            }
        }
        fileSeverity[file] = severity;
    }

    return { prGroups, fileSeverity };
}

async function fetchPrData(octokit: Octokit, owner: string, repo: string, number: number): Promise<PrFileData> {
    const [{ data: pr }, { data: files }] = await Promise.all([
        octokit.pulls.get({ owner, repo, pull_number: number }),
        octokit.pulls.listFiles({ owner, repo, pull_number: number, per_page: 100 }),
    ]);
    return {
        number,
        sha: pr.head.sha,
        files: files.map((f) => ({ path: f.filename, patch: f.patch ?? null })),
    };
}

// Parses unified-diff hunk headers like `@@ -10,5 +20,8 @@`. We only need the
// base side (oldStart, oldLines). Per spec, when the count is omitted it defaults
// to 1 (e.g. `@@ -42 +50,3 @@` means oldLines = 1).
function parseHunks(patch: string): BaseHunk[] {
    const hunks: BaseHunk[] = [];
    const re = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(patch)) !== null) {
        hunks.push({
            baseStart: parseInt(m[1], 10),
            baseLines: m[2] !== undefined ? parseInt(m[2], 10) : 1,
        });
    }
    return hunks;
}

function hunksOverlap(a: BaseHunk[], b: BaseHunk[]): boolean {
    for (const ai of a) {
        const aEnd = ai.baseStart + ai.baseLines;
        for (const bi of b) {
            const bEnd = bi.baseStart + bi.baseLines;
            if (ai.baseStart < bEnd && bi.baseStart < aEnd) return true;
        }
    }
    return false;
}
