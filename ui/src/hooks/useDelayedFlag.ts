import { useEffect, useState } from 'react';

// Returns true only once `active` has stayed true for `delayMs` — so a brief
// flicker (e.g. a fast, fully-cached check) never flashes whatever the flag
// gates. Resets to false the moment `active` goes false.
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
    const [shown, setShown] = useState(false);
    useEffect(() => {
        if (!active) {
            setShown(false);
            return;
        }
        const timer = setTimeout(() => setShown(true), delayMs);
        return () => clearTimeout(timer);
    }, [active, delayMs]);
    return shown;
}
