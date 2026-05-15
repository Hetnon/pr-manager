// Module-local store for the current CSRF token.
// AuthContext writes it on every checkSession; apiFetch reads it for
// state-changing requests.

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
    csrfToken = token;
}

export function getCsrfToken(): string | null {
    return csrfToken;
}
