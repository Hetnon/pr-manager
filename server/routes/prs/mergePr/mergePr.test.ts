import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import type { MergePrResult, MergeStrategy } from '@shared/merge.js';

const mockGetUserToken = jest.fn() as jest.Mock<(email: string) => Promise<string | null>>;
const mockMergePrApi = jest.fn() as jest.Mock<(owner: string, repo: string, prNumber: number, strategy: MergeStrategy | undefined, token: string) => Promise<MergePrResult>>;
const mockValidateRepo = jest.fn() as jest.Mock<(repo: string, token: string) => Promise<{ ok: true; owner: string; repo: string } | { ok: false; error: string }>>;

jest.unstable_mockModule('../../../databases/databases.js', () => ({ getUserToken: mockGetUserToken }));
jest.unstable_mockModule('../../../utils/mergePr.js', () => ({ mergePr: mockMergePrApi }));
jest.unstable_mockModule('../../../utils/validateRepo.js', () => ({ validateRepo: mockValidateRepo }));

const { mergePr } = await import('./mergePr.js');

function mockReqRes(body: Record<string, unknown>) {
    const req = { body, session: { userEmail: 'alice@example.com' } } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { req, res, status, json };
}

describe('mergePr', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects when owner is missing', async () => {
        const { req, res } = mockReqRes({ repo: 'app', prNumber: 1 });
        await expect(mergePr(req, res)).rejects.toThrow(/owner/);
    });

    it('rejects when repo is missing', async () => {
        const { req, res } = mockReqRes({ owner: 'alice', prNumber: 1 });
        await expect(mergePr(req, res)).rejects.toThrow(/repo/);
    });

    it('rejects when prNumber is missing or not a number', async () => {
        const { req, res } = mockReqRes({ owner: 'alice', repo: 'app' });
        await expect(mergePr(req, res)).rejects.toThrow(/prNumber/);
    });

    it('returns 401 when the user has no stored token', async () => {
        mockGetUserToken.mockResolvedValue(null);
        const { req, res } = mockReqRes({ owner: 'alice', repo: 'app', prNumber: 7 });
        await expect(mergePr(req, res)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('returns 400 when validateRepo fails', async () => {
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: false, error: 'no access' });
        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumber: 7 });
        await mergePr(req, res);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'no access' }));
    });

    it('returns 200 with the merge result on success', async () => {
        const result: MergePrResult = { ok: true, defaultBranch: 'main', steps: ['Merged'] };
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: true, owner: 'alice', repo: 'app' });
        mockMergePrApi.mockResolvedValue(result);

        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumber: 7, strategy: 'rebase' });
        await mergePr(req, res);

        expect(mockMergePrApi).toHaveBeenCalledWith('alice', 'app', 7, 'rebase', 'tok');
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith(result);
    });

    it('returns 500 when the GitHub merge call fails', async () => {
        const result: MergePrResult = { ok: false, error: 'not mergeable' };
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: true, owner: 'alice', repo: 'app' });
        mockMergePrApi.mockResolvedValue(result);

        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumber: 7 });
        await mergePr(req, res);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith(result);
    });
});
