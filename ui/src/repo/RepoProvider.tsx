import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadFolderHandle, loadKnownRepoSlugs, loadLastOpenedRepoPointerFromStorage } from './repoFolderStorage.js';
import { RepoContext, type RepoContextValue } from './RepoContext.js';

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
