import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import type { PR } from '@shared/pr.js';

const mockGetUserToken = jest.fn() as jest.Mock<(email: string) => Promise<string | null>>;
const mockFetchPRs = jest.fn() as jest.Mock<(owner: string, repo: string, token: string) => Promise<PR[]>>;
const mockValidateRepo = jest.fn() as jest.Mock<(repo: string, token: string) => Promise<{ ok: true; owner: string; repo: string } | { ok: false; error: string }>>;

jest.unstable_mockModule('../../../databases/databases.js', () => ({ getUserToken: mockGetUserToken }));
jest.unstable_mockModule('../../../utils/fetchPRs.js', () => ({ fetchPRs: mockFetchPRs }));
jest.unstable_mockModule('../../../utils/validateRepo.js', () => ({ validateRepo: mockValidateRepo }));

const { listPrs } = await import('./listPrs.js');

function mockReqRes(query: Record<string, string>) {
    const req = { query, session: { userEmail: 'alice@example.com' } } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { req, res, status, json };
}

describe('listPrs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects when owner is missing', async () => {
        const { req, res } = mockReqRes({ repo: 'app' });
        await expect(listPrs(req, res)).rejects.toThrow(/owner/);
    });

    it('rejects when repo is missing', async () => {
        const { req, res } = mockReqRes({ owner: 'alice' });
        await expect(listPrs(req, res)).rejects.toThrow(/repo/);
    });

    it('returns 401 when the user has no stored OAuth token', async () => {
        mockGetUserToken.mockResolvedValue(null);
        const { req, res } = mockReqRes({ owner: 'alice', repo: 'app' });
        await expect(listPrs(req, res)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('returns 400 + needsRepo when validateRepo fails', async () => {
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: false, error: 'Repo not found or no access.' });
        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app' });
        await listPrs(req, res);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ needsRepo: true, error: 'Repo not found or no access.' }));
    });

    it('passes owner+repo+token through to fetchPRs and returns the result', async () => {
        const prs = [{ number: 1, title: 'first' } as PR];
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: true, owner: 'alice', repo: 'app' });
        mockFetchPRs.mockResolvedValue(prs);

        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app' });
        await listPrs(req, res);

        expect(mockFetchPRs).toHaveBeenCalledWith('alice', 'app', 'tok');
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith(prs);
    });
});
