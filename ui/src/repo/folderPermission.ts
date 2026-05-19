// Permission helpers for FileSystemDirectoryHandle. Centralised so the badge
// and the action panels query/request through the same surface.

export type FolderPermLevel = 'readwrite' | 'read' | 'none' | 'unknown';

type Queryable = FileSystemDirectoryHandle & {
    queryPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

export async function queryFolderPermission(handle: FileSystemDirectoryHandle): Promise<FolderPermLevel> {
    const h = handle as Queryable;
    if (!h.queryPermission) return 'unknown';
    const rw = await h.queryPermission({ mode: 'readwrite' });
    if (rw === 'granted') return 'readwrite';
    const r = await h.queryPermission({ mode: 'read' });
    if (r === 'granted') return 'read';
    return 'none';
}

// Prompts the user for readwrite. Must be called from a user-gesture handler
// (button click) — browsers reject permission prompts in async chains
// disconnected from user input.
export async function requestFolderReadWrite(handle: FileSystemDirectoryHandle): Promise<FolderPermLevel> {
    const h = handle as Queryable;
    if (!h.requestPermission) return queryFolderPermission(handle);
    await h.requestPermission({ mode: 'readwrite' });
    return queryFolderPermission(handle);
}
