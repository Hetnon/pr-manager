import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { 
    clearFolderHandle, loadFolderHandle, loadKnownRepoSlugs, saveFolderHandle, 
    saveLastOpenedRepoPointerOnStorage, loadLastOpenedRepoPointerFromStorage 
} from './repoFolderStorage.js';
import { ensureFolderWritePermission } from './folderPermission.js';



export interface RepoContextValue {
    currentRepoSlug: string | null;                                    // canonical "owner/name" string
    currentRepoOwnerAndName: { owner: string; name: string } | null;   // currentRepoSlug string split into parts
    currentRepoFolderHandle: FileSystemDirectoryHandle | null;             // the local repo folder
    knownReposSlugs: string[];                                   // every remembered project
    browserHasAcessToCurrentFolder: boolean;                                   // whether we have read+write access to the folder -- the browser drops this on page reload so the user has to manually give access again, or by picking a new folder so it starts as false when the app loads and it's initiated at the context
    setBrowserHasAcessToCurrentFolder: (granted: boolean) => void;   // set by FolderAccessModal after a re-grant
    repoPickerOpen: boolean;
    setRepoPickerOpen: (open: boolean) => void;
    setRepo: (value: string | null, handle?: FileSystemDirectoryHandle | null) => void; // sets the repo and folder handle
    selectKnownRepo: (slug: string) => Promise<void>; // selects a repo from the known repos list
    forgetRepo: (slug: string) => Promise<void>; // removes the repo from the known repos list
}

export const RepoContext = createContext<RepoContextValue>({
    currentRepoSlug: null,
    currentRepoOwnerAndName: null,
    currentRepoFolderHandle: null,
    knownReposSlugs: [],
    browserHasAcessToCurrentFolder: false,
    setBrowserHasAcessToCurrentFolder: () => {},
    repoPickerOpen: false,
    setRepoPickerOpen: () => {},
    setRepo: () => {},
    selectKnownRepo: async () => {},
    forgetRepo: async () => {},
});




function parseRepoNameAndOwner(value: string | null): { owner: string; name: string } | null {
    if (!value) return null;
    const parts = value.split('/');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
    return { owner: parts[0].trim(), name: parts[1].trim() };
}



// Owns the current-repo selection (owner/name slug + local folder handle), whether
// we currently have folder access, and the set of remembered projects — persisted
// across reloads: the active slug in localStorage, the per-project folder handles
// in IndexedDB. Exposed through context so the whole tree reads it via
// useContext(RepoContext) instead of drilling props. The picker opens itself until
// a valid repo is chosen.
export function RepoProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [currentRepoSlug, setCurrentRepoSlug] = useState<string | null>(() => loadLastOpenedRepoPointerFromStorage());
    const [currentRepoFolderHandle, setCurrentRepoFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [knownReposSlugs, setKnownReposSlugs] = useState<string[]>([]);
    const [browserHasAcessToCurrentFolder, setBrowserHasAcessToCurrentFolder] = useState(false);
    const [repoPickerOpen, setRepoPickerOpen] = useState(false);
    const currentRepoOwnerAndName = useMemo(() => parseRepoNameAndOwner(currentRepoSlug), [currentRepoSlug]); // Memoized so its identity is stable across renders (only changes when the slug does) — consumers can safely use it as an effect dependency.
    
    async function loadRepos(): Promise<void> {
        const [folderHandleAux, knownRepoSlugsAux] = await Promise.all([
            currentRepoSlug ? loadFolderHandle(currentRepoSlug) : null,
            loadKnownRepoSlugs()
        ]);
        setCurrentRepoFolderHandle(folderHandleAux);
        setKnownReposSlugs(knownRepoSlugsAux);
    }
    
    useEffect(() => {
        void loadRepos();
    }, []);

    useEffect(() => {
        // Open the picker whenever there's no valid repo selected.
        if (!currentRepoOwnerAndName) setRepoPickerOpen(true);
    }, [currentRepoSlug]);

    // User picked a folder via the OS picker — it becomes the current project and
    // is remembered (handle keyed by slug). A freshly-picked handle arrives with
    // read+write already granted.
    const setRepo = useCallback((value: string | null, handle?: FileSystemDirectoryHandle | null) => {
        setCurrentRepoSlug(value);
        saveLastOpenedRepoPointerOnStorage(value);
        if (handle === undefined) return;
        setCurrentRepoFolderHandle(handle);
        setBrowserHasAcessToCurrentFolder(!!handle);
        if (!value) return;
        if (handle) {
            void saveFolderHandle(value, handle);
            setKnownReposSlugs((known) => (known.includes(value) ? known : [...known, value]));
        } else {
            void clearFolderHandle(value);
        }
    }, []);

    // Switch to an already-remembered project without re-opening the OS picker.
    // A stored handle has lost folder permission, so we re-grant it here — while we
    // still hold the click's user activation — before committing it as current.
    const selectKnownRepo = useCallback(async (slug: string) => {
        const handle = await loadFolderHandle(slug);
        const granted = handle ? await ensureFolderWritePermission(handle) : false;
        setCurrentRepoSlug(slug);
        saveLastOpenedRepoPointerOnStorage(slug);
        setCurrentRepoFolderHandle(handle);
        setBrowserHasAcessToCurrentFolder(granted);
    }, []);

    // Drop a remembered project's stored handle; clear the selection if it was active.
    const forgetRepo = useCallback(async (slug: string) => {
        await clearFolderHandle(slug);
        setKnownReposSlugs((known) => known.filter((remembered) => remembered !== slug));
        if (slug === currentRepoSlug) {
            setCurrentRepoSlug(null);
            saveLastOpenedRepoPointerOnStorage(null);
            setCurrentRepoFolderHandle(null);
            setBrowserHasAcessToCurrentFolder(false);
        }
    }, [currentRepoSlug]);

    const value = useMemo<RepoContextValue>(() => ({
        currentRepoSlug,
        currentRepoOwnerAndName,
        currentRepoFolderHandle,
        knownReposSlugs,
        browserHasAcessToCurrentFolder,
        setBrowserHasAcessToCurrentFolder,
        repoPickerOpen,
        setRepoPickerOpen,
        setRepo,
        selectKnownRepo,
        forgetRepo,
    }), [currentRepoSlug, currentRepoOwnerAndName, currentRepoFolderHandle, knownReposSlugs, browserHasAcessToCurrentFolder, repoPickerOpen, setRepo, selectKnownRepo, forgetRepo]);

    return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}
