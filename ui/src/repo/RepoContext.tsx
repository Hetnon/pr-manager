import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearFolderHandle, loadFolderHandle, loadKnownRepoSlugs, saveFolderHandle } from './repoFolderStorage.js';
import { ensureFolderWritePermission } from './folderPermission.js';

const STORAGE_KEY = 'pr-matrix.repo';

export interface RepoContextValue {
    repoSlug: string | null;                                    // canonical "owner/name" string
    repoOwnerAndName: { owner: string; name: string } | null;   // that string split into parts
    folderHandle: FileSystemDirectoryHandle | null;             // the local repo folder
    knownRepoSlugs: string[];                                   // every remembered project
    // Whether we hold read+write access to the folder this session. Granted by the
    // picker, by switching to a remembered repo, or by the entry gate's grant — and
    // false after a page reload (the browser drops FS access). The app's entry gate
    // (MainPage) blocks rendering until this is true, so everything downstream can
    // assume access and never re-checks.
    hasFolderAccess: boolean;
    setHasFolderAccess: (granted: boolean) => void;   // set by FolderAccessModal after a re-grant
    pickerOpen: boolean;
    setPickerOpen: (open: boolean) => void;
    // Repo mutators — each is consumed in exactly one place (setRepo → PickerActions,
    // selectKnownRepo + forgetRepo → AllProjects), but they live here because they
    // mutate the shared selection state this provider owns.
    setRepo: (value: string | null, handle?: FileSystemDirectoryHandle | null) => void;
    selectKnownRepo: (slug: string) => Promise<void>;
    forgetRepo: (slug: string) => Promise<void>;
}

// Default is the "no repo selected" state with no-op actions. In practice the
// RepoProvider (mounted in Root) always supplies the real value, so the default
// only satisfies the type — but it lets useContext(RepoContext) return a
// non-null value, so callers read it directly without a guard.
export const RepoContext = createContext<RepoContextValue>({
    repoSlug: null,
    repoOwnerAndName: null,
    folderHandle: null,
    knownRepoSlugs: [],
    hasFolderAccess: false,
    setHasFolderAccess: () => {},
    pickerOpen: false,
    setPickerOpen: () => {},
    setRepo: () => {},
    selectKnownRepo: async () => {},
    forgetRepo: async () => {},
});

// The default/last project pointer lives in localStorage; the per-project folder
// handles live in IndexedDB (see repoFolderStorage).
function rememberDefaultRepo(slug: string | null) {
    try {
        if (slug) localStorage.setItem(STORAGE_KEY, slug);
        else localStorage.removeItem(STORAGE_KEY);
    } catch { /* localStorage disabled — fine */ }
}

function parseRepo(value: string | null): { owner: string; name: string } | null {
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
    const [repoSlug, setRepoSlug] = useState<string | null>(() => {
        try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
    });
    const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [knownRepoSlugs, setKnownRepoSlugs] = useState<string[]>([]);
    // Starts false: a handle restored from IndexedDB on load has lost its browser
    // permission, so we must re-grant before the app can touch the folder.
    const [hasFolderAccess, setHasFolderAccess] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    // Memoized so its identity is stable across renders (only changes when the
    // slug does) — consumers can safely use it as an effect dependency.
    const repoOwnerAndName = useMemo(() => parseRepo(repoSlug), [repoSlug]);

    // On load, restore the last project's folder handle (migrating the legacy
    // single-handle store if present) and list the other remembered projects.
    // hasFolderAccess stays false until the entry gate re-grants.
    
    async function loadReposHandle(): Promise<void> {
        if (repoSlug) {
            const handle = await loadFolderHandle(repoSlug);
            if (handle) setFolderHandle(handle);
        }
        setKnownRepoSlugs(await loadKnownRepoSlugs());
    }
    
    useEffect(() => {
        void loadReposHandle();
    }, []);

    // Open the picker whenever there's no valid repo selected.
    useEffect(() => {
        if (!repoOwnerAndName) setPickerOpen(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repoSlug]);

    // User picked a folder via the OS picker — it becomes the current project and
    // is remembered (handle keyed by slug). A freshly-picked handle arrives with
    // read+write already granted.
    const setRepo = useCallback((value: string | null, handle?: FileSystemDirectoryHandle | null) => {
        setRepoSlug(value);
        rememberDefaultRepo(value);
        if (handle === undefined) return;
        setFolderHandle(handle);
        setHasFolderAccess(!!handle);
        if (!value) return;
        if (handle) {
            void saveFolderHandle(value, handle);
            setKnownRepoSlugs((known) => (known.includes(value) ? known : [...known, value]));
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
        setRepoSlug(slug);
        rememberDefaultRepo(slug);
        setFolderHandle(handle);
        setHasFolderAccess(granted);
    }, []);

    // Drop a remembered project's stored handle; clear the selection if it was active.
    const forgetRepo = useCallback(async (slug: string) => {
        await clearFolderHandle(slug);
        setKnownRepoSlugs((known) => known.filter((remembered) => remembered !== slug));
        if (slug === repoSlug) {
            setRepoSlug(null);
            rememberDefaultRepo(null);
            setFolderHandle(null);
            setHasFolderAccess(false);
        }
    }, [repoSlug]);

    const value = useMemo<RepoContextValue>(() => ({
        repoSlug,
        repoOwnerAndName,
        folderHandle,
        knownRepoSlugs,
        hasFolderAccess,
        setHasFolderAccess,
        pickerOpen,
        setPickerOpen,
        setRepo,
        selectKnownRepo,
        forgetRepo,
    }), [repoSlug, repoOwnerAndName, folderHandle, knownRepoSlugs, hasFolderAccess, pickerOpen, setRepo, selectKnownRepo, forgetRepo]);

    return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}
