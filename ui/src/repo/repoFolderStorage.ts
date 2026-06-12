import { loadString, saveString } from '../lib/localStorage.js';

const DB_NAME = 'pr-matrix';
const STORE = 'kv';
// Pre-multi-project builds stored a single handle under this fixed key. We now
// key handles by repo slug; this is migrated to its slug on first access.
const LEGACY_KEY = 'repo-folder-handle';
const LAST_OPENED_REPO_STORAGE_KEY = 'pr-matrix.repo';

export function saveLastOpenedRepoPointerOnStorage(slug: string | null) {
    saveString(LAST_OPENED_REPO_STORAGE_KEY, slug);
}

export function loadLastOpenedRepoPointerFromStorage(): string | null {
    return loadString(LAST_OPENED_REPO_STORAGE_KEY);
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) {
                request.result.createObjectStore(STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    });
}

async function withStore<T>(mode: IDBTransactionMode, storeOperation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(STORE, mode);
            const request = storeOperation(transaction.objectStore(STORE));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        });
    } finally {
        db.close();
    }
}

// Folder handles are keyed by repo slug ("owner/name") so several projects can be
// remembered at once and switched between without re-picking the folder.
export async function saveFolderHandle(currentRepoSlug: string, handle: FileSystemDirectoryHandle): Promise<void> {
    await withStore('readwrite', (store) => store.put(handle, currentRepoSlug));
}

export async function loadFolderHandle(currentRepoSlug: string): Promise<FileSystemDirectoryHandle | null> {
    const stored = await withStore<FileSystemDirectoryHandle | undefined>('readonly', (store) => store.get(currentRepoSlug));
    if (stored) return stored;
    // One-time migration: adopt the legacy single handle under the requested slug.
    const legacy = await withStore<FileSystemDirectoryHandle | undefined>('readonly', (store) => store.get(LEGACY_KEY));
    if (legacy) {
        await saveFolderHandle(currentRepoSlug, legacy);
        await withStore('readwrite', (store) => store.delete(LEGACY_KEY));
        return legacy;
    }
    return null;
}

export async function clearFolderHandle(currentRepoSlug: string): Promise<void> {
    await withStore('readwrite', (store) => store.delete(currentRepoSlug));
}

// The slugs of all remembered projects — drives the quick-switch list.
export async function loadKnownRepoSlugs(): Promise<string[]> {
    const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    return keys.filter((key): key is string => typeof key === 'string' && key !== LEGACY_KEY);
}
