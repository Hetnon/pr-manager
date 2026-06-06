// Permission helpers for FileSystemDirectoryHandle. Centralised so the badge
// and the action panels query/request through the same surface.

export type FolderPermLevel = 'readwrite' | 'read' | 'none' | 'unknown';

type Queryable = FileSystemDirectoryHandle & {
    queryPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

export async function queryFolderPermission(handle: FileSystemDirectoryHandle): Promise<FolderPermLevel> {
    const queryableHandle = handle as Queryable;
    if (!queryableHandle.queryPermission) return 'unknown';
    const readWriteState = await queryableHandle.queryPermission({ mode: 'readwrite' });
    if (readWriteState === 'granted') return 'readwrite';
    const readState = await queryableHandle.queryPermission({ mode: 'read' });
    if (readState === 'granted') return 'read';
    return 'none';
}

// Prompts the user for readwrite. Must be called from a user-gesture handler
// (button click) — browsers reject permission prompts in async chains
// disconnected from user input.
export async function requestFolderReadWrite(handle: FileSystemDirectoryHandle): Promise<FolderPermLevel> {
    const queryableHandle = handle as Queryable;
    if (!queryableHandle.requestPermission) return queryFolderPermission(handle);
    await queryableHandle.requestPermission({ mode: 'readwrite' });
    return queryFolderPermission(handle);
}

// Ensures readwrite, prompting if needed. Returns true if we now have it. Must
// be called from a user-gesture handler (button click) — browsers reject
// permission prompts outside user input.
export async function ensureFolderWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    if ((await queryFolderPermission(handle)) === 'readwrite') return true;
    return (await requestFolderReadWrite(handle)) === 'readwrite';
}
