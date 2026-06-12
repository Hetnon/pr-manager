import { getCsrfToken } from './csrf.js';

// Resolution order:
//   1. __API_BASE_URL__ injected at build time (set via webpack DefinePlugin
//      or the API_BASE_URL env var when running `npm run build`).
//   2. Derive from window.location — replace the project subdomain with the
//      api-dot variant. e.g. https://my-app.ts.r.appspot.com →
//      https://api-dot-my-app.ts.r.appspot.com.
function deriveApiBase(): string {
    if (typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__) {
        return __API_BASE_URL__;
    }
    const { protocol, hostname } = globalThis.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
    const parts = hostname.split('.');
    if (parts.length === 0) return '';
    parts[0] = `api-dot-${parts[0]}`;
    return `${protocol}//${parts.join('.')}`;
}

// The single resolved base for every UI→server call (REST here, git-proxy in api/git.ts).
export const API_BASE = deriveApiBase().replace(/\/+$/, '');

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
}

export class ApiError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data: unknown) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`, globalThis.location.origin);
    if (options.query) {
        for (const [key, value] of Object.entries(options.query)) {
            if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
        }
    }

    const method = options.method ?? 'GET';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (method !== 'GET') {
        const token = getCsrfToken();
        if (token) headers['CSRF-Token'] = token;
    }

    const response = await fetch(url.toString(), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: 'include',
    });

    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorData = data as { errorMessage?: string; error?: string } | undefined;
        throw new ApiError(errorData?.errorMessage ?? errorData?.error ?? `HTTP ${response.status}`, response.status, data);
    }
    return data as T;
}
