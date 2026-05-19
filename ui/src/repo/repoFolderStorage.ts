const DB_NAME = 'pr-matrix';
const STORE = 'kv';
const KEY = 'repo-folder-handle';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE)) {
                req.result.createObjectStore(STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const req = fn(tx.objectStore(STORE));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    await withStore('readwrite', (s) => s.put(handle, KEY));
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
    const result = await withStore<FileSystemDirectoryHandle | undefined>('readonly', (s) => s.get(KEY));
    return result ?? null;
}

export async function clearFolderHandle(): Promise<void> {
    await withStore('readwrite', (s) => s.delete(KEY));
}
