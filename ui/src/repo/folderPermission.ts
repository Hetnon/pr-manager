type PermissionedHandle = FileSystemDirectoryHandle & {
    // queryPermission and requestPermission are part of the File System Access API's permissions extension
    // They are not in the standardized WHATWG File System spec, so we have to cast the handle to this type here otherwise TypeScript will not compile
    queryPermission?: (opts?: { mode?: 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (opts?: { mode?: 'readwrite' }) => Promise<PermissionState>;
};

//queryPermission and requestPermission should return 'granted', 'denied', or 'prompt' - for our case we need 'granted' to proceed

export async function ensureFolderWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    // Ensures readwrite access, if not already granted. Returns true once we have it. Must run from a user-gesture handler (button click) 
    const permissionedHandle = handle as PermissionedHandle;

    if (!permissionedHandle.queryPermission) return false; // handle has no query permission method - return false
    
    if ((await permissionedHandle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
    
    if (!permissionedHandle.requestPermission) return false; // handle has no request permission method - return false
    return (await permissionedHandle.requestPermission({ mode: 'readwrite' })) === 'granted';
}
