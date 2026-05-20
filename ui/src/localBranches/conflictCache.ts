import type { LocalRepoSnapshot } from './readLocalRepo.js';
import type { LocalConflictReport } from './checkLocalConflicts.js';
import { makeFsApiFs } from '../repo/fsApiAdapter.js';

const CACHE_FILE = '/.tech_lead/conflicts.json';
const GIT_EXCLUDE = '/.git/info/exclude';
const CACHE_VERSION = 1;

interface CachePayload {
    version: number;
    savedAt: string;
    defaultBranch: string;
    defaultSha: string;
    branchShas: Record<string, string>;  // name → sha for every non-default branch in the snapshot
    report: LocalConflictReport;
}

// Returns a cached report iff every non-default branch in the current snapshot
// still points at the same sha recorded in the cache. Any change (new branch,
// removed branch, sha moved) invalidates — caller falls back to a fresh run.
export async function loadCachedReport(
    handle: FileSystemDirectoryHandle,
    snapshot: LocalRepoSnapshot,
): Promise<{ report: LocalConflictReport; savedAt: string } | null> {
    if (!snapshot.defaultBranch) return null;
    const fs = makeFsApiFs(handle);
    let text: string;
    try {
        text = (await fs.promises.readFile(CACHE_FILE, { encoding: 'utf8' })) as string;
    } catch {
        return null;
    }
    let cached: CachePayload;
    try {
        cached = JSON.parse(text) as CachePayload;
    } catch {
        return null;
    }
    if (cached.version !== CACHE_VERSION) return null;
    if (cached.defaultBranch !== snapshot.defaultBranch) return null;

    const currentShas = collectBranchShas(snapshot);
    const cachedShas = cached.branchShas;
    if (Object.keys(currentShas).length !== Object.keys(cachedShas).length) return null;
    for (const [name, sha] of Object.entries(currentShas)) {
        if (cachedShas[name] !== sha) return null;
    }
    if (cached.defaultSha !== cached.report.defaultSha) return null; // sanity

    // Validate the default branch sha — find it in the snapshot.
    const defaultBranchEntry = snapshot.branches.find((b) => b.name === snapshot.defaultBranch);
    if (!defaultBranchEntry || defaultBranchEntry.sha !== cached.defaultSha) return null;

    return { report: cached.report, savedAt: cached.savedAt };
}

export async function saveCachedReport(
    handle: FileSystemDirectoryHandle,
    snapshot: LocalRepoSnapshot,
    report: LocalConflictReport,
): Promise<void> {
    const fs = makeFsApiFs(handle);
    await ensureExcludeEntry(handle);
    try {
        await fs.promises.mkdir('/.tech_lead');
    } catch { /* mkdir is idempotent in our adapter (create:true on each segment); ignore anyway */ }
    const payload: CachePayload = {
        version: CACHE_VERSION,
        savedAt: new Date().toISOString(),
        defaultBranch: snapshot.defaultBranch ?? '',
        defaultSha: report.defaultSha,
        branchShas: collectBranchShas(snapshot),
        report,
    };
    await fs.promises.writeFile(CACHE_FILE, JSON.stringify(payload));
}

function collectBranchShas(snapshot: LocalRepoSnapshot): Record<string, string> {
    const out: Record<string, string> = {};
    for (const b of snapshot.branches) {
        if (b.name === snapshot.defaultBranch) continue;
        if (!b.sha) continue;
        out[b.name] = b.sha;
    }
    return out;
}

// Append `.tech_lead/` to .git/info/exclude (local-only ignore; never tracked).
// Idempotent — leaves the file alone if the entry is already there.
async function ensureExcludeEntry(handle: FileSystemDirectoryHandle): Promise<void> {
    const fs = makeFsApiFs(handle);
    let current = '';
    try {
        current = (await fs.promises.readFile(GIT_EXCLUDE, { encoding: 'utf8' })) as string;
    } catch {
        // File missing — that's fine, we'll create it.
    }
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
