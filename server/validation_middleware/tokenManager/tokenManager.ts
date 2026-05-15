import { csrfSync } from 'csrf-sync';
import type { Request, Response, NextFunction } from 'express';

// CSRF Protection setup with csrf-sync
let _generateToken: ((req: Request) => string) | undefined;
let _csrfSynchronisedProtection: ((req: Request, res: Response, next: NextFunction) => void) | undefined;

// Call this ONCE during server initialization
export function initializeCSRF(): void {
    const { csrfSynchronisedProtection, generateToken } = csrfSync({
        getTokenFromRequest: (req) => {
            return (req.headers['csrf-token'] as string) || (req.body as Record<string, string>)._csrf;
        },
    });
    _csrfSynchronisedProtection = csrfSynchronisedProtection as typeof _csrfSynchronisedProtection;
    _generateToken = generateToken as typeof _generateToken;
}

export function CSRFTokenGenerator(req: Request): string {
    if (!_generateToken) {
        throw new Error('CSRF not initialized. Call initializeCSRF first.');
    }
    return _generateToken(req);
}

export function syncCSRFProtection(req: Request, res: Response, next: NextFunction): void {
    if (!_csrfSynchronisedProtection) {
        const newError = Object.assign(new Error('CSRF not initialized'), { statusCode: 500 });
        return next(newError);
    }
    _csrfSynchronisedProtection(req, res, (err?: unknown) => {
        if (err) {
            const error = err as Error & { statusCode?: number };
            console.warn('CSRF validation failed:', error.message);
            error.statusCode = 403;
            return next(error);
        }
        next();
    });
}

// For testing only
export function _resetCSRF(): void {
    _generateToken = undefined;
    _csrfSynchronisedProtection = undefined;
}
