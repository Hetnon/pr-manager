import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRepoSelection } from './useRepoSelection.js';

export interface RepoContextValue {
    repo: string | null;                                        // canonical "owner/name" string
    repoOwnerAndName: { owner: string; name: string } | null;   // that string split into parts
    folderHandle: FileSystemDirectoryHandle | null;
    pickerOpen: boolean;
    openPicker: () => void;
    closePicker: () => void;
    // The repo setter — consumed only by RepoSelector when the user picks a folder.
    setRepo: (value: string | null, handle?: FileSystemDirectoryHandle | null) => void;
}

// Default is the "no repo selected" state with no-op actions. In practice the
// RepoProvider (mounted in Root) always supplies the real value, so the default
// only satisfies the type — but it lets useContext(RepoContext) return a
// non-null value, so callers read it directly without a guard.
export const RepoContext = createContext<RepoContextValue>({
    repo: null,
    repoOwnerAndName: null,
    folderHandle: null,
    pickerOpen: false,
    openPicker: () => {},
    closePicker: () => {},
    setRepo: () => {},
});

// Holds the current-repo selection (owner/name + local folder handle) and the
// picker's open state, so the whole tree can read them via useContext(RepoContext)
// instead of drilling props. The picker opens itself until a valid repo is chosen.
export function RepoProvider({ children }: Readonly<{ children: ReactNode }>) {
    const { repo, repoOwnerAndName, folderHandle, setRepoCallBack } = useRepoSelection();
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        if (!repoOwnerAndName) setPickerOpen(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo]);

    const openPicker = useCallback(() => setPickerOpen(true), []);
    const closePicker = useCallback(() => setPickerOpen(false), []);

    const value = useMemo<RepoContextValue>(() => ({
        repo,
        repoOwnerAndName,
        folderHandle,
        pickerOpen,
        openPicker,
        closePicker,
        setRepo: setRepoCallBack,
    }), [repo, repoOwnerAndName, folderHandle, pickerOpen, openPicker, closePicker, setRepoCallBack]);

    return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}
