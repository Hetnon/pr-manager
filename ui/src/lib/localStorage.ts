// Best-effort localStorage access: every operation swallows quota/disabled errors,
// so callers treat persistence as a cache that may silently no-op.

export function loadJson<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

export function saveJson(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* quota exceeded / storage disabled — best-effort */
    }
}

export function loadString(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

// A null value removes the key.
export function saveString(key: string, value: string | null): void {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        /* best-effort */
    }
}
