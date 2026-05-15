// @ts-nocheck
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import the module
const sessionModule = await import('./sessionConfig.js');
const { createSessionConfig, _resetSessionNameForTests } = sessionModule;

describe('sessionConfig', () => {
    let originalEnv;
    let store;

    beforeEach(async () => {
        // Save original env
        store = { touch: jest.fn(), get: jest.fn() };
        originalEnv = { ...process.env };
        
        // Reset the module state
        _resetSessionNameForTests();
    });

    afterEach(() => {
        // Restore original env
        process.env = originalEnv;
    });


    describe('createSessionConfig', () => {
        beforeEach(() => {
            process.env.SESSION_SECRET = 'test-secret-key';
            process.env.NODE_ENV = 'development';
        });

        it('should update session config with correct structure', () => {
            const config = createSessionConfig(store);

            expect(config).toHaveProperty('name');
            expect(config).toHaveProperty('store');
            expect(config).toHaveProperty('secret');
            expect(config).toHaveProperty('resave');
            expect(config).toHaveProperty('saveUninitialized');
            expect(config).toHaveProperty('cookie');
        });

        it('should use the session cookie name', () => {
            const config = createSessionConfig(store);
            expect(config.name).toBe('development');
        });

        it('should use provided store', () => {
            const config = createSessionConfig(store);

            expect(config.store).toBe(store);
        });

        it('should use SESSION_SECRET from environment', () => {
            process.env.SESSION_SECRET = 'super-secret-key';
            const config = createSessionConfig(store);

            expect(config.secret).toBe('super-secret-key');
        });

        it('should set resave to false', () => {
            const config = createSessionConfig(store);

            expect(config.resave).toBe(false);
        });

        it('should set saveUninitialized to false', () => {
            const config = createSessionConfig(store);

            expect(config.saveUninitialized).toBe(false);
        });

        it('should configure cookie with correct properties', () => {
            process.env.COOKIE_DOMAIN = 'localhost';
            const config = createSessionConfig(store);

            expect(config.cookie).toEqual({
                httpOnly: true,
                path: '/',
                secure: true,
                maxAge: 30 * 24 * 60 * 60 * 1000,
                sameSite: 'strict',
                domain: 'localhost'
            });
        });

        it('should set domain to localhost in development', () => {
            process.env.NODE_ENV = 'development';
            process.env.COOKIE_DOMAIN = 'localhost';
            const config = createSessionConfig(store);

            expect(config.cookie.domain).toBe('localhost');
        });

        it('should set domain to applyturbo.com in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.COOKIE_DOMAIN = 'applyturbo.com';
            const config = createSessionConfig(store);

            expect(config.cookie.domain).toBe('applyturbo.com');
        });

        it('should throw when NODE_ENV is not set', () => {
            delete process.env.NODE_ENV;
            expect(()=>createSessionConfig(store)).toThrow('NODE_ENV environment variable is required to set session cookie name');
            
        });

        it('should set domain to test in test environment', () => {
            process.env.COOKIE_DOMAIN = 'test';
            const config = createSessionConfig(store);

            expect(config.cookie.domain).toBe('test');
        });

        it('should set cookie maxAge to 30 days', () => {
            const config = createSessionConfig(store);
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

            expect(config.cookie.maxAge).toBe(thirtyDaysInMs);
        });

        it('should set cookie sameSite to strict', () => {
            const config = createSessionConfig(store);

            expect(config.cookie.sameSite).toBe('strict');
        });

        it('should set cookie secure to true', () => {
            const config = createSessionConfig(store);

            expect(config.cookie.secure).toBe(true);
        });

        it('should set cookie httpOnly to true', () => {
            const config = createSessionConfig(store);

            expect(config.cookie.httpOnly).toBe(true);
        });

        it('should throw error when SESSION_SECRET is not set', () => {
            delete process.env.SESSION_SECRET;

            expect(() => createSessionConfig(store)).toThrow('SESSION_SECRET environment variable is required');
        });

        it('should throw error when SESSION_SECRET is empty string', () => {
            process.env.SESSION_SECRET = '';

            expect(() => createSessionConfig(store)).toThrow('SESSION_SECRET environment variable is required');
        });
    });

    describe('integration tests', () => {
        it('should create valid session config for production', () => {
            process.env.NODE_ENV = 'production';
            process.env.SESSION_SECRET = 'production-secret';
            process.env.COOKIE_DOMAIN = 'applyturbo.com';
            const config = createSessionConfig(store);

            expect(config.name).toBe('production');
            expect(config.store).toBe(store);
            expect(config.secret).toBe('production-secret');
            expect(config.cookie.domain).toBe('applyturbo.com');
            expect(config.cookie.secure).toBe(true);
            expect(config.cookie.httpOnly).toBe(true);
            expect(config.cookie.sameSite).toBe('strict');
        });

        it('should create valid session config for development', () => {
            process.env.NODE_ENV = 'development';
            process.env.SESSION_SECRET = 'dev-secret';
            process.env.COOKIE_DOMAIN = 'localhost';
            
            const store = { get: jest.fn(), set: jest.fn() };
            const config = createSessionConfig(store);

            expect(config.name).toBe('development');
            expect(config.cookie.domain).toBe('localhost');
        });
    });
});
