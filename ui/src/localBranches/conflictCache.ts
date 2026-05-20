import { makeFsApiFs } from '../repo/fsApiAdapter.js';

const CACHE_FILE = '/.tech_lead/cache.json';
const GIT_EXCLUDE = '/.git/info/exclude';
const CACHE_VERSION = 2;

export type PairVerdict = 'clean' | 'conflict' | 'unknown';

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
    // (sorted sha pair + filepath) → 3-way merge verdict
    pairResults = new Map<string, PairVerdict>();

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
}

interface CacheShape {
    version: number;
    savedAt: string;
    mergeBases: Record<string, string>;
    branchFiles: Record<string, string[]>;
    defaultSinceBase: Record<string, string[]>;
    pairResults: Record<string, PairVerdict>;
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
    for (const [k, v] of Object.entries(parsed.mergeBases ?? {})) cache.mergeBases.set(k, v);
    for (const [k, v] of Object.entries(parsed.branchFiles ?? {})) cache.branchFiles.set(k, v);
    for (const [k, v] of Object.entries(parsed.defaultSinceBase ?? {})) cache.defaultSinceBase.set(k, v);
    for (const [k, v] of Object.entries(parsed.pairResults ?? {})) cache.pairResults.set(k, v);
    return cache;
}

export async function saveCache(handle: FileSystemDirectoryHandle, cache: ConflictCache): Promise<void> {
    const fs = makeFsApiFs(handle);
    await ensureExcludeEntry(handle);
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
    };
    await fs.promises.writeFile(CACHE_FILE, JSON.stringify(shape));
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
    if (lines.some((l) => l.trim() === '.tech_lead/' || l.trim() === '.tech_lead')) return;
    const sep = current.length === 0 || current.endsWith('\n') ? '' : '\n';
    const next = current + sep + '\n# pr-matrix local cache (not committed)\n.tech_lead/\n';
    try {
        await fs.promises.writeFile(GIT_EXCLUDE, next);
    } catch {
        // If we can't write the exclude (e.g., readonly), the cache still
        // works — the user's git status will just show the folder. Non-fatal.
    }
}
