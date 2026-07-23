import { createContext } from 'react';

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
