import { useCallback, useEffect, useState } from 'react';
import { clearFolderHandle, loadFolderHandle, saveFolderHandle } from './repoFolderStorage.js';

const STORAGE_KEY = 'pr-matrix.repo';

export interface RepoSelection {
    repo: string | null;        // canonical "owner/name" form
    parsed: { owner: string; name: string } | null;
    folderHandle: FileSystemDirectoryHandle | null;
    setRepoCallBack: (value: string | null, handle?: FileSystemDirectoryHandle | null) => void;
}

export function useRepoSelection(): RepoSelection {
    const [repo, setRepo] = useState<string | null>(() => {
        try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
    });
    const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);

    useEffect(() => {
        void loadFolderHandle().then((h) => { if (h) setFolderHandle(h); });
    }, []);

    const setRepoCallBack = useCallback((value: string | null, handle?: FileSystemDirectoryHandle | null) => {
        setRepo(value);
        try {
            if (value) localStorage.setItem(STORAGE_KEY, value);
            else localStorage.removeItem(STORAGE_KEY);
        } catch { /* localStorage disabled — fine */ }
        if (handle === undefined) return;
        setFolderHandle(handle);
        if (handle) void saveFolderHandle(handle);
        else void clearFolderHandle();
    }, []);

    return { repo, parsed: parseRepo(repo), folderHandle, setRepoCallBack };
}

export function parseRepo(value: string | null): { owner: string; name: string } | null {
    if (!value) return null;
    const parts = value.split('/');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
    return { owner: parts[0].trim(), name: parts[1].trim() };
}
