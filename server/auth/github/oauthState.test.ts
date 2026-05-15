import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { generateOauthState, verifyOauthState } from './oauthState.js';

describe('oauthState', () => {
    let originalSecret: string | undefined;

    beforeEach(() => {
        originalSecret = process.env.SESSION_SECRET;
        process.env.SESSION_SECRET = 'test-secret-not-for-real-use';
    });

    afterEach(() => {
        if (originalSecret !== undefined) process.env.SESSION_SECRET = originalSecret;
        else delete process.env.SESSION_SECRET;
        jest.restoreAllMocks();
    });

    it('round-trips: a fresh state verifies', () => {
        const state = generateOauthState();
        expect(verifyOauthState(state)).toBe(true);
    });

    it('produces unique tokens each call (fresh nonce)', () => {
        const a = generateOauthState();
        const b = generateOauthState();
        const c = generateOauthState();
        expect(new Set([a, b, c]).size).toBe(3);
    });

    it('rejects empty string', () => {
        expect(verifyOauthState('')).toBe(false);
    });

    it('rejects malformed base64', () => {
        expect(verifyOauthState('not-valid-base64-!!!')).toBe(false);
    });

    it('rejects a valid base64 string of the wrong length', () => {
        expect(verifyOauthState('aGVsbG8')).toBe(false);
    });

    it('rejects tampered HMAC bytes', () => {
        const state = generateOauthState();
        const buf = Buffer.from(state, 'base64url');
        buf[buf.length - 1] ^= 0xff;
        expect(verifyOauthState(buf.toString('base64url'))).toBe(false);
    });

    it('rejects tampered timestamp bytes', () => {
        const state = generateOauthState();
        const buf = Buffer.from(state, 'base64url');
        // Flip a byte in the timestamp section (bytes 16-23)
        buf[20] ^= 0xff;
        expect(verifyOauthState(buf.toString('base64url'))).toBe(false);
    });

    it('rejects tokens signed with a different secret', () => {
        const state = generateOauthState();
        process.env.SESSION_SECRET = 'a-completely-different-secret';
        expect(verifyOauthState(state)).toBe(false);
    });

    it('rejects expired tokens (>10 min old)', () => {
        const now = Date.now();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        const state = generateOauthState();
        nowSpy.mockReturnValue(now + 11 * 60 * 1000);
        expect(verifyOauthState(state)).toBe(false);
    });

    it('accepts tokens just inside the TTL', () => {
        const now = Date.now();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        const state = generateOauthState();
        nowSpy.mockReturnValue(now + 9 * 60 * 1000);
        expect(verifyOauthState(state)).toBe(true);
    });

    it('throws when SESSION_SECRET is missing on generate', () => {
        delete process.env.SESSION_SECRET;
        expect(() => generateOauthState()).toThrow(/SESSION_SECRET/);
    });
});
