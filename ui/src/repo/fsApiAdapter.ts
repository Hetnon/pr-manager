// Minimal node-style `fs` adapter backed by a File System Access API directory handle.
// Implements the surface isomorphic-git uses for read-only operations against an existing repo.
// Writes (writeFile/mkdir/rmdir/unlink) are stubbed throwing for the spike — to be implemented
// before push/promote work. Symlinks are not supported in FSAPI; reported as not-a-symlink.

type Encoding = 'utf8' | 'utf-8' | undefined;

interface ReadOpts { encoding?: Encoding }
interface WriteOpts { encoding?: Encoding; mode?: number }

// Node's fs accepts the encoding either as an options object (`{ encoding }`) or
// as a bare string (`'utf8'`). isomorphic-git uses the string form (e.g. when
// reading .gitignore), so we must accept both or text reads come back as binary.
function encodingOf(options: ReadOpts | WriteOpts | Encoding): Encoding {
    return typeof options === 'string' ? options : options?.encoding;
}

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

function splitPath(path: string): string[] {
    // Drop empty and `.` segments so `.`, `./`, `/`, and `''` all resolve to the
    // repo root. isomorphic-git's working-tree walk lstats `.` for the root; only
    // the literal `.` segment is dropped, so names like `.git`/`.gitignore` stay.
    return path.replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter((segment) => segment !== '' && segment !== '.');
}

export interface FsApiFs {
    promises: {
        readFile(path: string, options?: ReadOpts | Encoding): Promise<Uint8Array | string>;
        writeFile(path: string, data: Uint8Array | string, options?: WriteOpts | Encoding): Promise<void>;
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
        let currentDir: FileSystemDirectoryHandle = root;
        for (const segment of parts) {
            currentDir = await currentDir.getDirectoryHandle(segment, { create });
        }
        return currentDir;
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
            const fileHandle = await parent.getFileHandle(name);
            const file = await fileHandle.getFile();
            return new StatsLike('file', file.size, file.lastModified);
        } catch {
            throw new ENoEnt(path);
        }
    }

    return {
        promises: {
            async readFile(path: string, options?: ReadOpts | Encoding): Promise<Uint8Array | string> {
                const fileHandle = await getFile(path).catch(() => { throw new ENoEnt(path); });
                const file = await fileHandle.getFile();
                const encoding = encodingOf(options);
                if (encoding === 'utf8' || encoding === 'utf-8') {
                    return await file.text();
                }
                return new Uint8Array(await file.arrayBuffer());
            },

            async writeFile(path: string, data: Uint8Array | string, options?: WriteOpts | Encoding): Promise<void> {
                try {
                    const fileHandle = await getFile(path, true);
                    const writable = await (fileHandle as FileSystemFileHandle & {
                        createWritable: (opts?: { keepExistingData?: boolean }) => Promise<{
                            write: (data: unknown) => Promise<void>;
                            close: () => Promise<void>;
                        }>;
                    }).createWritable({ keepExistingData: false });
                    if (typeof data === 'string') {
                        const encoding = encodingOf(options);
                        if (encoding && encoding !== 'utf8' && encoding !== 'utf-8') {
                            throw new Error(`Unsupported encoding: ${encoding}`);
                        }
                        await writable.write(data);
                    } else {
                        // Wrap Uint8Array in a Blob to dodge TS's strict ArrayBuffer/SharedArrayBuffer split.
                        await writable.write(new Blob([data as unknown as BlobPart]));
                    }
                    await writable.close();
                } catch (error) {
                    throw wrapFsError(error, 'writeFile', path);
                }
            },

            async unlink(path: string): Promise<void> {
                try {
                    const parts = splitPath(path);
                    if (parts.length === 0) throw new ENoEnt(path);
                    const dir = await getDir(parts.slice(0, -1));
                    await dir.removeEntry(parts[parts.length - 1]);
                } catch (error) {
                    throw wrapFsError(error, 'unlink', path);
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
                } catch (error) {
                    throw wrapFsError(error, 'mkdir', path);
                }
            },

            async rmdir(path: string): Promise<void> {
                try {
                    const parts = splitPath(path);
                    if (parts.length === 0) throw new EPerm('cannot rmdir root');
                    const parent = await getDir(parts.slice(0, -1));
                    await parent.removeEntry(parts[parts.length - 1], { recursive: false });
                } catch (error) {
                    throw wrapFsError(error, 'rmdir', path);
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
class ENoEnt extends FsError { constructor(path: string) { super('ENOENT', `ENOENT: ${path}`); } }
class EPerm extends FsError { constructor(message: string) { super('EPERM', `EPERM: ${message}`); } }
class EInval extends FsError { constructor(message: string) { super('EINVAL', `EINVAL: ${message}`); } }

// Map raw FSAPI DOMException errors to node-style fs errors so isomorphic-git
// can reason about them and the user gets an informative message.
function wrapFsError(caughtError: unknown, operation: string, path: string): Error {
    if (caughtError instanceof FsError) return caughtError;
    const errorInfo = caughtError as { name?: string; message?: string };
    const name = errorInfo.name ?? '';
    if (name === 'NotFoundError') return new ENoEnt(`${operation} ${path}`);
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return new EPerm(`${operation} ${path} — folder permission likely 'read' only; re-pick with readwrite`);
    }
    if (name === 'TypeMismatchError') return new EPerm(`${operation} ${path} — path collides with existing file/dir of opposite kind`);
    if (name === 'InvalidModificationError') return new EPerm(`${operation} ${path} — invalid modification (often a write under read-only handle)`);
    return new Error(`fsApi ${operation} ${path}: ${name || 'Error'}: ${errorInfo.message ?? String(caughtError)}`);
}
