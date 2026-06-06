import { makeFsApiFs } from '../../repo/fsApiAdapter.js';

const CACHE_FILE = '/.tech_lead/cache.json';
const GIT_EXCLUDE = '/.git/info/exclude';
const CACHE_VERSION = 3;

export type PairVerdict = 'clean' | 'conflict' | 'unknown';

// A base-file line span, 1-based and inclusive: [start, end].
export type LineRange = [number, number];

// Result of a pairwise 3-way merge for one file. `regions` carries the
// base-file line spans where the two sides actually clash (only for conflicts)
// so the matrix can show *where* in a tooltip.
export interface PairResult {
    verdict: PairVerdict;
    regions?: LineRange[];
}

// Per-(branch, file) facts needed for identical-content detection and the
// "this branch edits lines X–Y" tooltip. `oid` is the file's blob oid at the
// branch HEAD (null if the branch deleted it); `ranges` are the base-file line
// spans the branch changed vs its default merge-base.
export interface BranchFileInfo {
    oid: string | null;
    ranges: LineRange[];
    headMissing: boolean;
    binary: boolean;
}

// Granular cache of pure-function results. Each entry is keyed by the SHAs it
// depends on, so it's always valid as long as the SHAs match — no staleness
// checks needed. Deleting one branch doesn't invalidate cache entries that
// don't involve it.
export class ConflictCache {
    // (branch.sha + default.sha) → merge-base sha
    mergeBases = new Map<string, string>();
    // (branch.sha + base.sha) → files the branch changed vs base
    branchFiles = new Map<string, string[]>();
    // (default.sha + base.sha) → files default changed vs base
    defaultSinceBase = new Map<string, string[]>();
    // (sorted sha pair + filepath) → 3-way merge verdict + conflict regions
    pairResults = new Map<string, PairResult>();
    // (branch.sha + base.sha + filepath) → blob oid + changed line ranges
    branchFileInfo = new Map<string, BranchFileInfo>();

    hits = 0;
    misses = 0;

    mergeBaseKey(branchSha: string, defaultSha: string): string {
        return `${branchSha}|${defaultSha}`;
    }
    branchFilesKey(branchSha: string, baseSha: string): string {
        return `${branchSha}|${baseSha}`;
    }
    defaultSinceBaseKey(defaultSha: string, baseSha: string): string {
        return `${defaultSha}|${baseSha}`;
    }
    pairResultKey(shaA: string, shaB: string, file: string): string {
        const [first, second] = shaA < shaB ? [shaA, shaB] : [shaB, shaA];
        return `${first}|${second}|${file}`;
    }
    branchFileInfoKey(branchSha: string, baseSha: string, file: string): string {
        return `${branchSha}|${baseSha}|${file}`;
    }
}

interface CacheShape {
    version: number;
    savedAt: string;
    mergeBases: Record<string, string>;
    branchFiles: Record<string, string[]>;
    defaultSinceBase: Record<string, string[]>;
    pairResults: Record<string, PairResult>;
    branchFileInfo: Record<string, BranchFileInfo>;
}

export async function loadCache(handle: FileSystemDirectoryHandle): Promise<ConflictCache> {
    const fs = makeFsApiFs(handle);
    const cache = new ConflictCache();
    let text: string;
    try {
        text = (await fs.promises.readFile(CACHE_FILE, { encoding: 'utf8' })) as string;
    } catch {
        return cache;
    }
    let parsed: CacheShape;
    try {
        parsed = JSON.parse(text) as CacheShape;
    } catch {
        return cache;
    }
    if (parsed.version !== CACHE_VERSION) return cache; // start fresh on version bump
    for (const [key, value] of Object.entries(parsed.mergeBases ?? {})) cache.mergeBases.set(key, value);
    for (const [key, value] of Object.entries(parsed.branchFiles ?? {})) cache.branchFiles.set(key, value);
    for (const [key, value] of Object.entries(parsed.defaultSinceBase ?? {})) cache.defaultSinceBase.set(key, value);
    for (const [key, value] of Object.entries(parsed.pairResults ?? {})) cache.pairResults.set(key, value);
    for (const [key, value] of Object.entries(parsed.branchFileInfo ?? {})) cache.branchFileInfo.set(key, value);
    return cache;
}

async function writeCacheJson(fs: ReturnType<typeof makeFsApiFs>, cache: ConflictCache): Promise<void> {
    try {
        await fs.promises.mkdir('/.tech_lead');
    } catch { /* idempotent */ }
    const shape: CacheShape = {
        version: CACHE_VERSION,
        savedAt: new Date().toISOString(),
        mergeBases: Object.fromEntries(cache.mergeBases),
        branchFiles: Object.fromEntries(cache.branchFiles),
        defaultSinceBase: Object.fromEntries(cache.defaultSinceBase),
        pairResults: Object.fromEntries(cache.pairResults),
        branchFileInfo: Object.fromEntries(cache.branchFileInfo),
    };
    await fs.promises.writeFile(CACHE_FILE, JSON.stringify(shape));
}

// Lightweight persist used between files during analysis: just rewrites
// cache.json. Skips the .git/info/exclude read (done once via
// ensureCacheIgnored) so it's cheap enough to drive from the background writer.
async function flushCache(handle: FileSystemDirectoryHandle, cache: ConflictCache): Promise<void> {
    await writeCacheJson(makeFsApiFs(handle), cache);
}

export interface CacheWriter {
    // Request a write of the cache's current state. Returns immediately; the
    // write happens in the background.
    schedule(): void;
    // Await all outstanding/in-flight writes.
    drain(): Promise<void>;
}

// A single-flight, coalescing background writer for the cache.
//
// `schedule()` returns immediately so the analysis loop never blocks on I/O.
// Writes run strictly one-at-a-time (never concurrent → cache.json can't be
// torn by overlapping writes), and any `schedule()` calls that arrive while a
// write is in flight collapse into exactly one follow-up write of the latest
// state — so a burst of files costs one extra write, not one per file. Each
// write serializes the cache synchronously at write time, so it always captures
// a consistent, up-to-date snapshot.
export function createCacheWriter(handle: FileSystemDirectoryHandle, cache: ConflictCache): CacheWriter {
    let inFlight: Promise<void> | null = null;
    let queued = false;

    async function runLoop(): Promise<void> {
        try {
            do {
                queued = false;
                try {
                    await flushCache(handle, cache);
                } catch {
                    // Best-effort: a failed write must not break analysis. The
                    // next schedule() (or the final drain) will retry.
                }
            } while (queued);
        } finally {
            inFlight = null;
        }
    }

    return {
        schedule() {
            if (inFlight) { queued = true; return; }
            inFlight = runLoop();
        },
        async drain() {
            if (inFlight) await inFlight;
        },
    };
}

// Add `.tech_lead/` to .git/info/exclude once, up front, so the background
// writer's flushes during a long run never leave an untracked folder visible in
// git status even if the run is interrupted before it finishes.
export async function ensureCacheIgnored(handle: FileSystemDirectoryHandle): Promise<void> {
    await ensureExcludeEntry(handle);
}

// Append `.tech_lead/` to .git/info/exclude (local-only ignore; never tracked).
// Idempotent — leaves the file alone if the entry is already there.
async function ensureExcludeEntry(handle: FileSystemDirectoryHandle): Promise<void> {
    const fs = makeFsApiFs(handle);
    let current = '';
    try {
        current = (await fs.promises.readFile(GIT_EXCLUDE, { encoding: 'utf8' })) as string;
    } catch { /* file missing — we'll create it */ }
    const lines = current.split(/\r?\n/);
    if (lines.some((line) => line.trim() === '.tech_lead/' || line.trim() === '.tech_lead')) return;
    const separator = current.length === 0 || current.endsWith('\n') ? '' : '\n';
    const next = current + separator + '\n# pr-matrix local cache (not committed)\n.tech_lead/\n';
    try {
        await fs.promises.writeFile(GIT_EXCLUDE, next);
    } catch {
        // If we can't write the exclude (e.g., readonly), the cache still
        // works — the user's git status will just show the folder. Non-fatal.
    }
}
