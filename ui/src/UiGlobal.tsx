import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';

export interface UiGlobalContextValue {
    loading: boolean;
    beginLoading: () => void;
    endLoading: () => void;
}

export const UiGlobalContext = createContext<UiGlobalContextValue>({
    loading: false,
    beginLoading: () => {},
    endLoading: () => {},
});

// `loading` is reference-counted so overlapping actions don't clear each other's flag.
export default function UiGlobal({ children }: Readonly<{ children: ReactNode }>) {
    const [loadingCount, setLoadingCount] = useState(0);
    const beginLoading = useCallback(() => setLoadingCount((count) => count + 1), []);
    const endLoading = useCallback(() => setLoadingCount((count) => count - 1), []);

    const value = useMemo<UiGlobalContextValue>(() => ({
        loading: loadingCount > 0,
        beginLoading,
        endLoading,
    }), [loadingCount, beginLoading, endLoading]);

    return <UiGlobalContext.Provider value={value}>{children}</UiGlobalContext.Provider>;
}
