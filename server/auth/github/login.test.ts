import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { githubLogin } from './login.js';
import { verifyOauthState } from './oauthState.js';

function mockResponse() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return {
        status,
        json,
        asResponse: { status } as unknown as Response,
    };
}

function lastJsonPayload(json: jest.Mock): { url: string } {
    return (json.mock.calls[0] as unknown as [{ url: string }])[0];
}

describe('githubLogin', () => {
    const snapshot = { ...process.env };

    beforeEach(() => {
        process.env.SESSION_SECRET = 'test-secret';
        process.env.GITHUB_CLIENT_ID = 'Iv1.test-client';
        process.env.GITHUB_REDIRECT_URI = 'https://localhost:3030/api/auth/github/callback';
        delete process.env.GITHUB_OAUTH_SCOPES;
    });

    afterEach(() => {
        process.env = { ...snapshot };
    });

    it('responds 200 with a github.com authorize URL', async () => {
        const res = mockResponse();
        await githubLogin({} as Request, res.asResponse);
        expect(res.status).toHaveBeenCalledWith(200);
        const { url } = lastJsonPayload(res.json);
        expect(url).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/);
    });

    it('includes the configured client_id and redirect_uri', async () => {
        const res = mockResponse();
        await githubLogin({} as Request, res.asResponse);
        const params = new URL(lastJsonPayload(res.json).url).searchParams;
        expect(params.get('client_id')).toBe('Iv1.test-client');
        expect(params.get('redirect_uri')).toBe('https://localhost:3030/api/auth/github/callback');
        expect(params.get('allow_signup')).toBe('true');
    });

    it('includes a verifiable HMAC-signed state', async () => {
        const res = mockResponse();
        await githubLogin({} as Request, res.asResponse);
        const state = new URL(lastJsonPayload(res.json).url).searchParams.get('state')!;
        expect(state.length).toBeGreaterThan(0);
        expect(verifyOauthState(state)).toBe(true);
    });

    it('uses default scopes when GITHUB_OAUTH_SCOPES is unset', async () => {
        const res = mockResponse();
        await githubLogin({} as Request, res.asResponse);
        const params = new URL(lastJsonPayload(res.json).url).searchParams;
        expect(params.get('scope')).toBe('repo read:user user:email');
    });

    it('respects a custom GITHUB_OAUTH_SCOPES', async () => {
        process.env.GITHUB_OAUTH_SCOPES = 'read:user';
        const res = mockResponse();
        await githubLogin({} as Request, res.asResponse);
        const params = new URL(lastJsonPayload(res.json).url).searchParams;
        expect(params.get('scope')).toBe('read:user');
    });

    it('throws when GITHUB_CLIENT_ID is missing', async () => {
        delete process.env.GITHUB_CLIENT_ID;
        const res = mockResponse();
        await expect(githubLogin({} as Request, res.asResponse)).rejects.toThrow(/GITHUB_CLIENT_ID/);
    });

    it('throws when GITHUB_REDIRECT_URI is missing', async () => {
        delete process.env.GITHUB_REDIRECT_URI;
        const res = mockResponse();
        await expect(githubLogin({} as Request, res.asResponse)).rejects.toThrow(/GITHUB_REDIRECT_URI/);
    });

    it('generates a fresh state on each call', async () => {
        const r1 = mockResponse();
        const r2 = mockResponse();
        await githubLogin({} as Request, r1.asResponse);
        await githubLogin({} as Request, r2.asResponse);
        const s1 = new URL(lastJsonPayload(r1.json).url).searchParams.get('state');
        const s2 = new URL(lastJsonPayload(r2.json).url).searchParams.get('state');
        expect(s1).not.toBe(s2);
    });
});
