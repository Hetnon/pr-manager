import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

// ─── module mocks ────────────────────────────────────────────────────────────
const mockGetUserByGithubId = jest.fn() as jest.Mock<(id: number) => Promise<unknown>>;
const mockCreateUserDB = jest.fn() as jest.Mock<(data: unknown) => Promise<unknown>>;
const mockUpdateUserFields = jest.fn() as jest.Mock<(email: string, fields: unknown) => Promise<unknown>>;
const mockStoreUserToken = jest.fn() as jest.Mock<(email: string, token: string, scopes: string[]) => Promise<void>>;
const mockIncludeUserInfoToSession = jest.fn() as jest.Mock<(req: unknown, email: string, type: string, status: string) => Promise<void>>;

jest.unstable_mockModule('../../databases/databases.js', () => ({
    getUserByGithubId: mockGetUserByGithubId,
    createUserDB: mockCreateUserDB,
    updateUserFields: mockUpdateUserFields,
    storeUserToken: mockStoreUserToken,
}));

jest.unstable_mockModule('../../expressSession/expressSession.js', () => ({
    includeUserInfoToSession: mockIncludeUserInfoToSession,
}));

const { githubCallback } = await import('./callback.js');
const { generateOauthState } = await import('./oauthState.js');

// ─── helpers ─────────────────────────────────────────────────────────────────
function mockResponse() {
    const redirect = jest.fn();
    return { redirect, asResponse: { redirect } as unknown as Response };
}

function reqWith(query: Record<string, string>): Request {
    return { query, session: {} } as unknown as Request;
}

// Fake fetch that delivers a queue of responses in order.
function setupFetch(responses: Array<{ ok: boolean; body: unknown }>) {
    let i = 0;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => {
        const r = responses[i++];
        if (!r) throw new Error('fetch called more times than mocked');
        return {
            ok: r.ok,
            status: r.ok ? 200 : 500,
            json: async () => r.body,
            text: async () => JSON.stringify(r.body),
        } as unknown as Response;
    }) as typeof fetch;
}

// ─── tests ───────────────────────────────────────────────────────────────────
describe('githubCallback', () => {
    const envSnapshot = { ...process.env };

    beforeEach(() => {
        process.env.SESSION_SECRET = 'test-secret';
        process.env.GITHUB_CLIENT_ID = 'Iv1.test';
        process.env.GITHUB_CLIENT_SECRET = 'shhh';
        process.env.GITHUB_REDIRECT_URI = 'https://localhost:3030/api/auth/github/callback';
        process.env.POST_LOGIN_REDIRECT = 'https://localhost:3000/';
        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env = { ...envSnapshot };
    });

    it('rejects when code is missing', async () => {
        const res = mockResponse();
        await expect(githubCallback(reqWith({ state: generateOauthState() }), res.asResponse))
            .rejects.toThrow(/code is required/);
    });

    it('rejects when state is missing', async () => {
        const res = mockResponse();
        await expect(githubCallback(reqWith({ code: 'X' }), res.asResponse))
            .rejects.toThrow(/state is required/);
    });

    it('rejects when state fails HMAC verification', async () => {
        const res = mockResponse();
        await expect(githubCallback(reqWith({ code: 'X', state: 'definitely-tampered' }), res.asResponse))
            .rejects.toThrow(/state invalid/);
    });

    it('creates a new user on first login and stores the token', async () => {
        setupFetch([
            { ok: true, body: { access_token: 'gho_xxx', scope: 'repo,read:user' } },
            { ok: true, body: { id: 42, login: 'alice', email: 'alice@example.com', name: 'Alice', avatar_url: 'http://a' } },
        ]);
        mockGetUserByGithubId.mockResolvedValue(null);
        mockCreateUserDB.mockResolvedValue({ success: true });
        mockStoreUserToken.mockResolvedValue(undefined);
        mockIncludeUserInfoToSession.mockResolvedValue(undefined);

        const res = mockResponse();
        await githubCallback(reqWith({ code: 'X', state: generateOauthState() }), res.asResponse);

        expect(mockCreateUserDB).toHaveBeenCalledWith(expect.objectContaining({
            userEmail: 'alice@example.com',
            githubLogin: 'alice',
            githubId: 42,
        }));
        expect(mockUpdateUserFields).not.toHaveBeenCalled();
        expect(mockStoreUserToken).toHaveBeenCalledWith('alice@example.com', 'gho_xxx', ['repo', 'read:user']);
        expect(mockIncludeUserInfoToSession).toHaveBeenCalledWith(expect.anything(), 'alice@example.com', 'user', 'active');
        expect(res.redirect).toHaveBeenCalledWith('https://localhost:3000/');
    });

    it('updates an existing user (by githubId) and preserves their userType', async () => {
        setupFetch([
            { ok: true, body: { access_token: 'gho_new', scope: 'repo' } },
            { ok: true, body: { id: 42, login: 'alice-renamed', email: 'new@example.com', name: 'A', avatar_url: 'http://a' } },
        ]);
        mockGetUserByGithubId.mockResolvedValue({ userEmail: 'original@example.com', userType: 'admin' });
        mockUpdateUserFields.mockResolvedValue({});
        mockStoreUserToken.mockResolvedValue(undefined);
        mockIncludeUserInfoToSession.mockResolvedValue(undefined);

        const res = mockResponse();
        await githubCallback(reqWith({ code: 'X', state: generateOauthState() }), res.asResponse);

        expect(mockCreateUserDB).not.toHaveBeenCalled();
        expect(mockUpdateUserFields).toHaveBeenCalledWith('original@example.com', expect.objectContaining({
            githubLogin: 'alice-renamed',
        }));
        expect(mockStoreUserToken).toHaveBeenCalledWith('original@example.com', 'gho_new', ['repo']);
        expect(mockIncludeUserInfoToSession).toHaveBeenCalledWith(expect.anything(), 'original@example.com', 'admin', 'active');
    });

    it('fetches /user/emails when the user profile has no public email', async () => {
        setupFetch([
            { ok: true, body: { access_token: 'gho_x', scope: 'user:email' } },
            { ok: true, body: { id: 1, login: 'bob', email: null, name: 'Bob', avatar_url: 'http://b' } },
            { ok: true, body: [
                { email: 'bob+work@example.com', primary: false, verified: true },
                { email: 'bob@example.com', primary: true, verified: true },
            ] },
        ]);
        mockGetUserByGithubId.mockResolvedValue(null);
        mockCreateUserDB.mockResolvedValue({ success: true });
        mockStoreUserToken.mockResolvedValue(undefined);
        mockIncludeUserInfoToSession.mockResolvedValue(undefined);

        const res = mockResponse();
        await githubCallback(reqWith({ code: 'X', state: generateOauthState() }), res.asResponse);

        expect(mockCreateUserDB).toHaveBeenCalledWith(expect.objectContaining({
            userEmail: 'bob@example.com',
        }));
    });

    it('throws 502 when GitHub returns no access_token', async () => {
        setupFetch([
            { ok: true, body: { error: 'bad_verification_code', error_description: 'expired' } },
        ]);
        const res = mockResponse();
        await expect(githubCallback(reqWith({ code: 'X', state: generateOauthState() }), res.asResponse))
            .rejects.toMatchObject({ statusCode: 502 });
    });
});
