const DB_NAME = 'pr-matrix';
const STORE = 'kv';
const KEY = 'repo-folder-handle';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) {
                request.result.createObjectStore(STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore<T>(mode: IDBTransactionMode, storeOperation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(STORE, mode);
            const request = storeOperation(transaction.objectStore(STORE));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } finally {
        db.close();
    }
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    await withStore('readwrite', (store) => store.put(handle, KEY));
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
    const result = await withStore<FileSystemDirectoryHandle | undefined>('readonly', (store) => store.get(KEY));
    return result ?? null;
}

export async function clearFolderHandle(): Promise<void> {
    await withStore('readwrite', (store) => store.delete(KEY));
}
