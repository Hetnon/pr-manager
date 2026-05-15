import { useCallback, useState } from 'react';

const STORAGE_KEY = 'pr-matrix.repo';

export interface RepoSelection {
    repo: string | null;        // canonical "owner/name" form
    setRepo: (value: string | null) => void;
    parsed: { owner: string; name: string } | null;
}

export function useRepoSelection(): RepoSelection {
    const [repo, setRepoState] = useState<string | null>(() => {
        try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
    });

    const setRepo = useCallback((value: string | null) => {
        setRepoState(value);
        try {
            if (value) localStorage.setItem(STORAGE_KEY, value);
            else localStorage.removeItem(STORAGE_KEY);
        } catch { /* localStorage disabled — fine */ }
    }, []);

    return { repo, setRepo, parsed: parseRepo(repo) };
}

export function parseRepo(value: string | null): { owner: string; name: string } | null {
    if (!value) return null;
    const parts = value.split('/');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
    return { owner: parts[0].trim(), name: parts[1].trim() };
}
