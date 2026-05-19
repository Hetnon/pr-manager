import { getCsrfToken } from '../api/csrf.js';

// Shape isomorphic-git expects from a custom http client. Keeping it loose so
// we don't depend on the library's private types — push() will pass us these
// objects regardless.
interface GitHttpRequest {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: AsyncIterableIterator<Uint8Array>;
}

interface GitHttpResponse {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: AsyncIterableIterator<Uint8Array>;
    statusCode: number;
    statusMessage: string;
}

// Custom http adapter for isomorphic-git. Routes every git smart-HTTP request
// through our server proxy (which attaches the user's OAuth token before
// forwarding to github.com). Adds the CSRF token for state-changing requests
// since the proxy sits under syncCSRFProtection middleware.
export const proxiedGitHttp = {
    async request({ url, method = 'GET', headers = {}, body }: GitHttpRequest): Promise<GitHttpResponse> {
        const finalHeaders: Record<string, string> = { ...headers };
        if (method !== 'GET' && method !== 'HEAD') {
            const csrf = getCsrfToken();
            if (csrf) finalHeaders['CSRF-Token'] = csrf;
        }

        let fetchBody: Uint8Array | undefined;
        if (body) {
            const chunks: Uint8Array[] = [];
            for await (const chunk of body) chunks.push(chunk);
            const total = chunks.reduce((n, c) => n + c.byteLength, 0);
            fetchBody = new Uint8Array(total);
            let offset = 0;
            for (const c of chunks) { fetchBody.set(c, offset); offset += c.byteLength; }
        }

        const response = await fetch(url, {
            method,
            headers: finalHeaders,
            body: fetchBody as unknown as BodyInit | undefined,
            credentials: 'include',
        });

        const respBuf = new Uint8Array(await response.arrayBuffer());
        const respHeaders: Record<string, string> = {};
        response.headers.forEach((v, k) => { respHeaders[k] = v; });

        return {
            url: response.url,
            method,
            statusCode: response.status,
            statusMessage: response.statusText,
            headers: respHeaders,
            body: (async function* () { yield respBuf; })(),
        };
    },
};
