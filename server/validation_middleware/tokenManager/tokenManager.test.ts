import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

// Mock csrf-sync
const mockGenerateToken = jest.fn();
const mockCsrfSynchronisedProtection = jest.fn();
const mockCsrfSync = jest.fn();

jest.unstable_mockModule('csrf-sync', () => ({
    csrfSync: mockCsrfSync
}));

// Import after mocking
const { initializeCSRF, CSRFTokenGenerator, syncCSRFProtection, _resetCSRF } = await import('./tokenManager.js');

describe('CSRF Token Manager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        _resetCSRF();

        // Default mock setup
        mockCsrfSync.mockReturnValue({
            csrfSynchronisedProtection: mockCsrfSynchronisedProtection,
            generateToken: mockGenerateToken
        });
    });

    describe('initializeCSRF', () => {
        it('should initialize CSRF with correct configuration', () => {
            initializeCSRF();

            expect(mockCsrfSync).toHaveBeenCalledTimes(1);
            expect(mockCsrfSync).toHaveBeenCalledWith({
                getTokenFromRequest: expect.any(Function)
            });
        });

        it('should configure getTokenFromRequest to read from headers', () => {
            initializeCSRF();

            const config = (mockCsrfSync.mock.calls[0] as [{ getTokenFromRequest: (req: Partial<Request>) => string }])[0];
            const req = {
                headers: { 'csrf-token': 'token-from-header' },
                body: { _csrf: 'token-from-body' }
            };

            const token = config.getTokenFromRequest(req as Partial<Request>);
            expect(token).toBe('token-from-header');
        });

        it('should configure getTokenFromRequest to fallback to body', () => {
            initializeCSRF();

            const config = (mockCsrfSync.mock.calls[0] as [{ getTokenFromRequest: (req: Partial<Request>) => string }])[0];
            const req = {
                headers: {},
                body: { _csrf: 'token-from-body' }
            };

            const token = config.getTokenFromRequest(req as Partial<Request>);
            expect(token).toBe('token-from-body');
        });

        it('should configure getTokenFromRequest to return undefined when no token', () => {
            initializeCSRF();

            const config = (mockCsrfSync.mock.calls[0] as [{ getTokenFromRequest: (req: Partial<Request>) => unknown }])[0];
            const req = {
                headers: {},
                body: {}
            };

            const token = config.getTokenFromRequest(req as Partial<Request>);
            expect(token).toBeUndefined();
        });

        it('should allow multiple initializations', () => {
            initializeCSRF();
            initializeCSRF();

            expect(mockCsrfSync).toHaveBeenCalledTimes(2);
        });
    });

    describe('CSRFTokenGenerator', () => {
        let req: Partial<Request>;

        beforeEach(() => {
            req = { session: { id: 'test-session' } as Request['session'] };
            mockGenerateToken.mockReturnValue('generated-csrf-token');
        });

        it('should throw error when CSRF is not initialized', () => {
            expect(() => CSRFTokenGenerator(req as Request)).toThrow('CSRF not initialized. Call initializeCSRF first.');
        });

        it('should generate token after initialization', () => {
            initializeCSRF();

            const token = CSRFTokenGenerator(req as Request);

            expect(mockGenerateToken).toHaveBeenCalledWith(req);
            expect(token).toBe('generated-csrf-token');
        });

        it('should pass request to generateToken', () => {
            initializeCSRF();

            const customReq = { session: { id: 'custom-session' } as Request['session'], body: { user: 'test' } };
            CSRFTokenGenerator(customReq as unknown as Request);

            expect(mockGenerateToken).toHaveBeenCalledWith(customReq);
        });

        it('should return different tokens on multiple calls', () => {
            initializeCSRF();
            mockGenerateToken
                .mockReturnValueOnce('token-1')
                .mockReturnValueOnce('token-2')
                .mockReturnValueOnce('token-3');

            const token1 = CSRFTokenGenerator(req as Request);
            const token2 = CSRFTokenGenerator(req as Request);
            const token3 = CSRFTokenGenerator(req as Request);

            expect(token1).toBe('token-1');
            expect(token2).toBe('token-2');
            expect(token3).toBe('token-3');
        });
    });

    describe('syncCSRFProtection', () => {
        let req: Partial<Request>;
        let res: Partial<Response>;
        let next: jest.MockedFunction<NextFunction>;

        beforeEach(() => {
            req = { headers: { 'csrf-token': 'valid-token' } };
            res = {};
            next = jest.fn() as typeof next;
        });

        it('should call next with error when CSRF is not initialized', () => {
            syncCSRFProtection(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledTimes(1);
            const error = next.mock.calls[0][0] as Error & { statusCode: number };
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('CSRF not initialized');
            expect(error.statusCode).toBe(500);
        });

        it('should call csrfSynchronisedProtection middleware', () => {
            initializeCSRF();
            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: null) => void) => {
                callback(null);
            });

            syncCSRFProtection(req as Request, res as Response, next);

            expect(mockCsrfSynchronisedProtection).toHaveBeenCalledWith(req, res, expect.any(Function));
        });

        it('should call next() on successful CSRF validation', () => {
            initializeCSRF();
            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: null) => void) => {
                callback(null);
            });

            syncCSRFProtection(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should call next with error on CSRF validation failure', () => {
            initializeCSRF();
            const csrfError = new Error('Invalid CSRF token');
            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: Error) => void) => {
                callback(csrfError);
            });

            syncCSRFProtection(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(csrfError);
            expect((csrfError as Error & { statusCode: number }).statusCode).toBe(403);
        });

        it('should log warning on CSRF validation failure', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            initializeCSRF();
            const csrfError = new Error('Token mismatch');
            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: Error) => void) => {
                callback(csrfError);
            });

            syncCSRFProtection(req as Request, res as Response, next);

            expect(consoleWarnSpy).toHaveBeenCalledWith('CSRF validation failed:', 'Token mismatch');

            consoleWarnSpy.mockRestore();
        });

        it('should set statusCode to 403 on validation error', () => {
            initializeCSRF();
            const csrfError = new Error('CSRF failed');
            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: Error) => void) => {
                callback(csrfError);
            });

            syncCSRFProtection(req as Request, res as Response, next);

            const passedError = next.mock.calls[0][0] as Error & { statusCode: number };
            expect(passedError.statusCode).toBe(403);
        });

        it('should not call next multiple times', () => {
            initializeCSRF();
            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: null) => void) => {
                callback(null);
            });

            syncCSRFProtection(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('_resetCSRF', () => {
        it('should reset CSRF state', () => {
            initializeCSRF();

            const req = {} as Request;
            mockGenerateToken.mockReturnValue('token');
            expect(CSRFTokenGenerator(req)).toBe('token');

            _resetCSRF();

            expect(() => CSRFTokenGenerator(req)).toThrow('CSRF not initialized');
        });

        it('should allow re-initialization after reset', () => {
            initializeCSRF();
            _resetCSRF();
            initializeCSRF();

            const req = {} as Request;
            mockGenerateToken.mockReturnValue('new-token');

            expect(() => CSRFTokenGenerator(req)).not.toThrow();
            expect(CSRFTokenGenerator(req)).toBe('new-token');
        });
    });

    describe('integration scenarios', () => {
        it('should work in typical request flow', () => {
            initializeCSRF();

            const req = { session: { id: 'session-123' } as Request['session'] } as Request;
            mockGenerateToken.mockReturnValue('csrf-token-abc');
            const token = CSRFTokenGenerator(req);
            expect(token).toBe('csrf-token-abc');

            const protectedReq = { headers: { 'csrf-token': 'csrf-token-abc' } } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as jest.MockedFunction<NextFunction>;

            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: null) => void) => {
                callback(null);
            });

            syncCSRFProtection(protectedReq, res, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should reject invalid token', () => {
            initializeCSRF();

            const req = { headers: { 'csrf-token': 'invalid-token' } } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as jest.MockedFunction<NextFunction>;

            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: Error) => void) => {
                callback(new Error('Invalid token'));
            });

            syncCSRFProtection(req, res, next);

            const error = next.mock.calls[0][0] as Error & { statusCode: number };
            expect(error.message).toBe('Invalid token');
            expect(error.statusCode).toBe(403);
        });

        it('should handle missing token gracefully', () => {
            initializeCSRF();

            const req = { headers: {}, body: {} } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as jest.MockedFunction<NextFunction>;

            mockCsrfSynchronisedProtection.mockImplementation((_req: unknown, _res: unknown, callback: (err: Error) => void) => {
                callback(new Error('CSRF token not found'));
            });

            syncCSRFProtection(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });
    });
});
