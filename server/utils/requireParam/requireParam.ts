import type { AppError } from '@shared/error.js';

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
    const newError = new Error(message) as AppError;
    newError.statusCode = 400;
    throw newError;
}
