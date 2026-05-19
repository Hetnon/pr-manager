// HTTP-aware Error extension used across the server (and shared so the UI
// can match the response shape on the wire). statusCode is optional; missing
// = treat as 500. The index signature accommodates ad-hoc props the global
// error handler serializes onto the response.
export interface AppError extends Error {
    statusCode?: number;
    [key: string]: unknown;
}
