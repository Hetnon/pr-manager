// Minimal node-style `fs` adapter backed by a File System Access API directory handle.
// Implements the surface isomorphic-git uses for read-only operations against an existing repo.
// Writes (writeFile/mkdir/rmdir/unlink) are stubbed throwing for the spike — to be implemented
// before push/promote work. Symlinks are not supported in FSAPI; reported as not-a-symlink.

type Encoding = 'utf8' | 'utf-8' | undefined;

interface ReadOpts { encoding?: Encoding }
interface WriteOpts { encoding?: Encoding; mode?: number }

class StatsLike {
    type: 'file' | 'dir';
    mode: number;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
    uid = 1;
    gid = 1;
    dev = 1;
    ino = 1;
    constructor(type: 'file' | 'dir', size: number, mtimeMs: number) {
        this.type = type;
        this.mode = type === 'dir' ? 0o040755 : 0o100644;
        this.size = size;
        this.mtimeMs = mtimeMs;
        this.ctimeMs = mtimeMs;
    }
    isFile() { return this.type === 'file'; }
    isDirectory() { return this.type === 'dir'; }
    isSymbolicLink() { return false; }
}

function splitPath(p: string): string[] {
    return p.replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter(Boolean);
}

export interface FsApiFs {
    promises: {
        readFile(path: string, opts?: ReadOpts): Promise<Uint8Array | string>;
        writeFile(path: string, data: Uint8Array | string, opts?: WriteOpts): Promise<void>;
        unlink(path: string): Promise<void>;
        readdir(path: string): Promise<string[]>;
        mkdir(path: string): Promise<void>;
        rmdir(path: string): Promise<void>;
        stat(path: string): Promise<StatsLike>;
        lstat(path: string): Promise<StatsLike>;
        readlink(path: string): Promise<string>;
        symlink(target: string, path: string): Promise<void>;
        chmod(path: string, mode: number): Promise<void>;
    };
}

export function makeFsApiFs(root: FileSystemDirectoryHandle): FsApiFs {
    async function getDir(parts: string[], create = false): Promise<FileSystemDirectoryHandle> {
        let h: FileSystemDirectoryHandle = root;
        for (const seg of parts) {
            h = await h.getDirectoryHandle(seg, { create });
        }
        return h;
    }

    async function getFile(path: string, create = false): Promise<FileSystemFileHandle> {
        const parts = splitPath(path);
        if (parts.length === 0) throw new ENoEnt(path);
        const fileName = parts[parts.length - 1];
        const dirHandle = await getDir(parts.slice(0, -1), create);
        return dirHandle.getFileHandle(fileName, { create });
    }

    async function pathStat(path: string): Promise<StatsLike> {
        const parts = splitPath(path);
        if (parts.length === 0) {
            return new StatsLike('dir', 0, 0);
        }
        const name = parts[parts.length - 1];
        const parentParts = parts.slice(0, -1);
        let parent: FileSystemDirectoryHandle;
        try {
            parent = await getDir(parentParts);
        } catch {
            throw new ENoEnt(path);
        }
        try {
            await parent.getDirectoryHandle(name);
            return new StatsLike('dir', 0, 0);
        } catch { /* not a dir */ }
        try {
            const fh = await parent.getFileHandle(name);
            const f = await fh.getFile();
            return new StatsLike('file', f.size, f.lastModified);
        } catch {
            throw new ENoEnt(path);
        }
    }

    return {
        promises: {
            async readFile(path: string, opts?: ReadOpts): Promise<Uint8Array | string> {
                const fh = await getFile(path).catch(() => { throw new ENoEnt(path); });
                const f = await fh.getFile();
                if (opts?.encoding === 'utf8' || opts?.encoding === 'utf-8') {
                    return await f.text();
                }
                return new Uint8Array(await f.arrayBuffer());
            },

            async writeFile(path: string, data: Uint8Array | string, opts?: WriteOpts): Promise<void> {
                try {
                    const fh = await getFile(path, true);
                    const writable = await (fh as FileSystemFileHandle & {
                        createWritable: (opts?: { keepExistingData?: boolean }) => Promise<{
                            write: (data: unknown) => Promise<void>;
                            close: () => Promise<void>;
                        }>;
                    }).createWritable({ keepExistingData: false });
                    if (typeof data === 'string') {
                        if (opts?.encoding && opts.encoding !== 'utf8' && opts.encoding !== 'utf-8') {
                            throw new Error(`Unsupported encoding: ${opts.encoding}`);
                        }
                        await writable.write(data);
                    } else {
                        // Wrap Uint8Array in a Blob to dodge TS's strict ArrayBuffer/SharedArrayBuffer split.
                        await writable.write(new Blob([data as unknown as BlobPart]));
                    }
                    await writable.close();
                } catch (e) {
                    throw wrapFsError(e, 'writeFile', path);
                }
            },

            async unlink(path: string): Promise<void> {
                try {
                    const parts = splitPath(path);
                    if (parts.length === 0) throw new ENoEnt(path);
                    const dir = await getDir(parts.slice(0, -1));
                    await dir.removeEntry(parts[parts.length - 1]);
                } catch (e) {
                    throw wrapFsError(e, 'unlink', path);
                }
            },

            async readdir(path: string): Promise<string[]> {
                const dir = await getDir(splitPath(path)).catch(() => { throw new ENoEnt(path); });
                const names: string[] = [];
                for await (const name of (dir as FileSystemDirectoryHandle & {
                    keys: () => AsyncIterable<string>;
                }).keys()) {
                    names.push(name);
                }
                return names;
            },

            async mkdir(path: string): Promise<void> {
                try {
                    await getDir(splitPath(path), true);
                } catch (e) {
                    throw wrapFsError(e, 'mkdir', path);
                }
            },

            async rmdir(path: string): Promise<void> {
                try {
                    const parts = splitPath(path);
                    if (parts.length === 0) throw new EPerm('cannot rmdir root');
                    const parent = await getDir(parts.slice(0, -1));
                    await parent.removeEntry(parts[parts.length - 1], { recursive: false });
                } catch (e) {
                    throw wrapFsError(e, 'rmdir', path);
                }
            },

            async stat(path: string): Promise<StatsLike> {
                return pathStat(path);
            },

            async lstat(path: string): Promise<StatsLike> {
                return pathStat(path);
            },

            async readlink(_path: string): Promise<string> {
                throw new EInval('symlinks not supported via FSAPI');
            },

            async symlink(_target: string, _path: string): Promise<void> {
                throw new EInval('symlinks not supported via FSAPI');
            },

            async chmod(_path: string, _mode: number): Promise<void> {
                // FSAPI has no concept of file modes; silently ignore.
            },
        },
    };
}

class FsError extends Error {
    code: string;
    constructor(code: string, message: string) {
        super(message);
        this.code = code;
        this.name = code;
    }
}
class ENoEnt extends FsError { constructor(p: string) { super('ENOENT', `ENOENT: ${p}`); } }
class EPerm extends FsError { constructor(m: string) { super('EPERM', `EPERM: ${m}`); } }
class EInval extends FsError { constructor(m: string) { super('EINVAL', `EINVAL: ${m}`); } }

// Map raw FSAPI DOMException errors to node-style fs errors so isomorphic-git
// can reason about them and the user gets an informative message.
function wrapFsError(e: unknown, op: string, path: string): Error {
    if (e instanceof FsError) return e;
    const err = e as { name?: string; message?: string };
    const name = err.name ?? '';
    if (name === 'NotFoundError') return new ENoEnt(`${op} ${path}`);
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return new EPerm(`${op} ${path} — folder permission likely 'read' only; re-pick with readwrite`);
    }
    if (name === 'TypeMismatchError') return new EPerm(`${op} ${path} — path collides with existing file/dir of opposite kind`);
    if (name === 'InvalidModificationError') return new EPerm(`${op} ${path} — invalid modification (often a write under read-only handle)`);
    return new Error(`fsApi ${op} ${path}: ${name || 'Error'}: ${err.message ?? String(e)}`);
}
