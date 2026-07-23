import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { UiGlobalContext, type UiGlobalContextValue } from './UiGlobalContext.js';

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
