import * as git from 'isomorphic-git';
import { makeFsApiFs } from '../../repo/fsApiAdapter.js';

export interface WorkingTreeStatus {
    clean: boolean;
    untracked: string[];  // new files not in the index
    modified: string[];   // tracked files whose content changed
    deleted: string[];    // tracked files removed from the working tree
}

// One file's stat as recorded in .git/index.
interface IndexEntry {
    mtimeSeconds: number;
    size: number;
    oid: string;
}

const CACHE_DIR = '.tech_lead';
const decoder = new TextDecoder();

/**
 * Fast working-tree status, the way `git status` does it.
 *
 * isomorphic-git's `statusMatrix` re-hashes every file because the File System
 * Access API can't supply the inode/ctime its stat-cache check needs. So we do
 * git's own `core.checkStat=minimal` shortcut ourselves: read each file's
 * recorded mtime+size from `.git/index`, walk the working tree, and only hash a
 * file when its mtime (to the second) or size differs from the index. On a clean
 * tree that means ~zero hashing.
 *
 * `onProgress` is throttled (~every 50th file) so the UI can show it working.
 */
export async function readWorkingTreeStatus(
    handle: FileSystemDirectoryHandle,
    onProgress?: (event: { file: string; scanned: number }) => void,
): Promise<WorkingTreeStatus> {
    const fs = makeFsApiFs(handle);
    const index = await readGitIndex(fs);

    const untracked: string[] = [];
    const modified: string[] = [];
    const seen = new Set<string>();
    let scanned = 0;

    async function ignored(filepath: string): Promise<boolean> {
        try {
            return await git.isIgnored({ fs, dir: '/', filepath });
        } catch {
            return false;
        }
    }

    async function walk(dirHandle: FileSystemDirectoryHandle, prefix: string): Promise<void> {
        const entries = (dirHandle as FileSystemDirectoryHandle & {
            entries(): AsyncIterable<[string, FileSystemHandle]>;
        }).entries();
        for await (const [name, entry] of entries) {
            const path = prefix ? `${prefix}/${name}` : name;
            if (entry.kind === 'directory') {
                if (name === '.git' || path === CACHE_DIR) continue;
                // Prune whole ignored subtrees (node_modules, dist, …) with one check.
                if (await ignored(path)) continue;
                await walk(entry as FileSystemDirectoryHandle, path);
                continue;
            }
            seen.add(path);
            scanned++;
            if (onProgress && (scanned === 1 || scanned % 50 === 0)) onProgress({ file: path, scanned });

            const indexed = index.get(path);
            if (indexed) {
                const file = await (entry as FileSystemFileHandle).getFile();
                // Stat shortcut: unchanged mtime (to the second) + size → not modified.
                if (Math.floor(file.lastModified / 1000) === indexed.mtimeSeconds && file.size === indexed.size) continue;
                // Stat moved — the only case we actually hash, to confirm a real change.
                const oid = await gitBlobOid(new Uint8Array(await file.arrayBuffer())).catch(() => null);
                if (oid === null || oid !== indexed.oid) modified.push(path);
            } else if (!(await ignored(path))) {
                untracked.push(path);
            }
        }
    }
    await walk(handle, '');

    const deleted = [...index.keys()].filter((p) => !seen.has(p)).sort();
    untracked.sort();
    modified.sort();
    return {
        clean: untracked.length === 0 && modified.length === 0 && deleted.length === 0,
        untracked,
        modified,
        deleted,
    };
}

// Parses the path → {mtime, size, oid} entries from .git/index (v2/v3). Returns
// an empty map if there's no index. Throws on an unrecognized/newer format so
// the caller can surface it rather than silently mis-reporting.
async function readGitIndex(fs: ReturnType<typeof makeFsApiFs>): Promise<Map<string, IndexEntry>> {
    const map = new Map<string, IndexEntry>();
    let bytes: Uint8Array;
    try {
        bytes = (await fs.promises.readFile('/.git/index')) as Uint8Array;
    } catch {
        return map; // no index yet (fresh repo) → everything is untracked
    }
    if (bytes.length < 12) return map;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Signature "DIRC"
    if (!(bytes[0] === 0x44 && bytes[1] === 0x49 && bytes[2] === 0x52 && bytes[3] === 0x43)) {
        throw new Error('unrecognized git index (no DIRC signature)');
    }
    const version = view.getUint32(4, false);
    if (version !== 2 && version !== 3) {
        throw new Error(`unsupported git index version ${version} (only v2/v3)`);
    }
    const count = view.getUint32(8, false);

    let off = 12;
    for (let i = 0; i < count && off + 62 <= bytes.length; i++) {
        const entryStart = off;
        const mtimeSeconds = view.getUint32(off + 8, false);
        const size = view.getUint32(off + 36, false);
        let oid = '';
        for (let b = 0; b < 20; b++) oid += bytes[off + 40 + b].toString(16).padStart(2, '0');
        const flags = view.getUint16(off + 60, false);
        let nameOff = off + 62;
        if (version >= 3 && (flags & 0x4000) !== 0) nameOff += 2; // extended flags present
        let end = nameOff;
        while (end < bytes.length && bytes[end] !== 0) end++;
        const name = decoder.decode(bytes.subarray(nameOff, end));
        map.set(name, { mtimeSeconds, size, oid });
        // Entries are NUL-terminated and padded to a multiple of 8 bytes.
        off = entryStart + (((end - entryStart) + 8) & ~7);
    }
    return map;
}

// Git blob object id of some content: SHA-1 of the git blob object (a small
// header, a NUL byte, then the content), via the platform's native crypto
// (fast; secure-context only — the dev server is https).
async function gitBlobOid(content: Uint8Array): Promise<string> {
    const header = new TextEncoder().encode(`blob ${content.length}`);
    const full = new Uint8Array(header.length + 1 + content.length);
    full.set(header, 0);
    full[header.length] = 0; // NUL separating the header from the content
    full.set(content, header.length + 1);
    const digest = await crypto.subtle.digest('SHA-1', full);
    let hex = '';
    for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
    return hex;
}
