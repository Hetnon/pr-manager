// AppError extends Error with an HTTP statusCode — used throughout the server
export interface AppError extends Error {
    statusCode?: number;
}

/**
 * Throws a 400 error if value is falsy.
 * Replaces the common pattern:
 *   if (!value) { const e = new Error(msg); e.statusCode = 400; throw e; }
 */
export function requireParam(value: unknown, message: string, type: string | null = null): void {
    if (!value) {
        throwValidationError(message);
    }
    if (type && typeof value !== type) {
        throwValidationError(message);
    }
}

/**
 * Throws a 400 validation error unconditionally.
 * Use inside complex conditionals where requireParam doesn't fit:
 *   if (typeof x !== 'number') throwValidationError('Must be a number');
 */
export function throwValidationError(message: string): never {
    const newError: AppError = new Error(message);
    newError.statusCode = 400;
    throw newError;
}
