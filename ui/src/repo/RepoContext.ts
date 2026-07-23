import { createContext, type Dispatch, type SetStateAction } from 'react';

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
