import { createContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { loadFolderHandle, loadKnownRepoSlugs, loadLastOpenedRepoPointerFromStorage } from './repoFolderStorage.js';

export interface RepoContextValue {
    currentRepoSlug: string | null;                                    // canonical "owner/name" string
    currentRepoOwnerAndName: { owner: string; name: string } | null;   // currentRepoSlug split into parts
    currentRepoFolderHandle: FileSystemDirectoryHandle | null;         // the local repo folder
    knownReposSlugs: string[];                                         // every remembered project
    browserHasAcessToCurrentFolder: boolean;                           // browser drops folder access on reload, so this starts false and is re-granted via FolderAccessModal
    repoPickerOpen: boolean;
    restoringRepos: boolean;                                           // true while the persisted repo + handle are being rehydrated on mount
    setCurrentRepoSlug: Dispatch<SetStateAction<string | null>>;
    setCurrentRepoFolderHandle: Dispatch<SetStateAction<FileSystemDirectoryHandle | null>>;
    setKnownReposSlugs: Dispatch<SetStateAction<string[]>>;
    setBrowserHasAcessToCurrentFolder: Dispatch<SetStateAction<boolean>>;
    setRepoPickerOpen: Dispatch<SetStateAction<boolean>>;
}

export const RepoContext = createContext<RepoContextValue>({
    currentRepoSlug: null,
    currentRepoOwnerAndName: null,
    currentRepoFolderHandle: null,
    knownReposSlugs: [],
    browserHasAcessToCurrentFolder: false,
    repoPickerOpen: false,
    restoringRepos: true,
    setCurrentRepoSlug: () => {},
    setCurrentRepoFolderHandle: () => {},
    setKnownReposSlugs: () => {},
    setBrowserHasAcessToCurrentFolder: () => {},
    setRepoPickerOpen: () => {},
});

function parseRepoNameAndOwner(value: string | null): { owner: string; name: string } | null {
    if (!value) return null;
    const parts = value.split('/');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
    return { owner: parts[0].trim(), name: parts[1].trim() };
}

export function RepoProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [currentRepoSlug, setCurrentRepoSlug] = useState<string | null>(() => loadLastOpenedRepoPointerFromStorage());
    const [currentRepoFolderHandle, setCurrentRepoFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [knownReposSlugs, setKnownReposSlugs] = useState<string[]>([]);
    const [browserHasAcessToCurrentFolder, setBrowserHasAcessToCurrentFolder] = useState(false);
    const [repoPickerOpen, setRepoPickerOpen] = useState(false);
    const [restoringRepos, setRestoringRepos] = useState(true);
    const currentRepoOwnerAndName = useMemo(() => parseRepoNameAndOwner(currentRepoSlug), [currentRepoSlug]); // stable identity across renders so consumers can use it as an effect dependency

    async function loadRepos(): Promise<void> {
        try {
            const [folderHandleAux, knownRepoSlugsAux] = await Promise.all([
                currentRepoSlug ? loadFolderHandle(currentRepoSlug) : null,
                loadKnownRepoSlugs()
            ]);
            setCurrentRepoFolderHandle(folderHandleAux);
            setKnownReposSlugs(knownRepoSlugsAux);
        } finally {
            setRestoringRepos(false);
        }
    }

    useEffect(() => {
        void loadRepos();
    }, []);

    useEffect(() => {
        if (!currentRepoOwnerAndName) setRepoPickerOpen(true); // no valid repo selected — force the picker open
    }, [currentRepoSlug]);

    const value = useMemo<RepoContextValue>(() => ({
        currentRepoSlug, setCurrentRepoSlug,
        currentRepoOwnerAndName, setCurrentRepoFolderHandle,
        currentRepoFolderHandle,
        knownReposSlugs, setKnownReposSlugs,
        browserHasAcessToCurrentFolder, setBrowserHasAcessToCurrentFolder,
        repoPickerOpen, setRepoPickerOpen,
        restoringRepos,
    }), [
        currentRepoSlug,
        currentRepoOwnerAndName,
        currentRepoFolderHandle,
        knownReposSlugs,
        browserHasAcessToCurrentFolder,
        repoPickerOpen,
        restoringRepos,
    ]);

    return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}
