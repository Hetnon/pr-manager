import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import type { CheckBaseConflictResult } from '@shared/conflicts.js';

const mockGetUserToken = jest.fn() as jest.Mock<(email: string) => Promise<string | null>>;
const mockCheckBaseConflict = jest.fn() as jest.Mock<(owner: string, repo: string, prNumber: number, token: string) => Promise<CheckBaseConflictResult>>;
const mockValidateRepo = jest.fn() as jest.Mock<(repo: string, token: string) => Promise<{ ok: true; owner: string; repo: string } | { ok: false; error: string }>>;

jest.unstable_mockModule('../../../databases/databases.js', () => ({ getUserToken: mockGetUserToken }));
jest.unstable_mockModule('../../../utils/checkBaseConflict.js', () => ({ checkBaseConflict: mockCheckBaseConflict }));
jest.unstable_mockModule('../../../utils/validateRepo.js', () => ({ validateRepo: mockValidateRepo }));

const { checkBaseConflicts } = await import('./checkBaseConflicts.js');

function mockReqRes(body: Record<string, unknown>) {
    const req = { body, session: { userEmail: 'alice@example.com' } } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { req, res, status, json };
}

describe('checkBaseConflicts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects when owner is missing', async () => {
        const { req, res } = mockReqRes({ repo: 'app', prNumbers: [1] });
        await expect(checkBaseConflicts(req, res)).rejects.toThrow(/owner/);
    });

    it('rejects when repo is missing', async () => {
        const { req, res } = mockReqRes({ owner: 'alice', prNumbers: [1] });
        await expect(checkBaseConflicts(req, res)).rejects.toThrow(/repo/);
    });

    it('rejects when prNumbers is not an array', async () => {
        const { req, res } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: 'oops' });
        await expect(checkBaseConflicts(req, res)).rejects.toThrow(/prNumbers/);
    });

    it('returns 401 when the user has no stored token', async () => {
        mockGetUserToken.mockResolvedValue(null);
        const { req, res } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: [1] });
        await expect(checkBaseConflicts(req, res)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('returns 400 when validateRepo fails', async () => {
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: false, error: 'no access' });
        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: [1] });
        await checkBaseConflicts(req, res);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'no access' }));
    });

    it('checks each PR and returns a results map keyed by PR number', async () => {
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: true, owner: 'alice', repo: 'app' });
        mockCheckBaseConflict.mockImplementation(async (_o, _r, n) => ({
            ok: true,
            defaultBranch: 'main',
            clean: true,
            conflicts: [],
            touchedByBase: [],
            baseLastTouched: {},
        } satisfies CheckBaseConflictResult & { _n?: number } as CheckBaseConflictResult));

        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: [1, 2, 3] });
        await checkBaseConflicts(req, res);

        expect(mockCheckBaseConflict).toHaveBeenCalledTimes(3);
        expect(status).toHaveBeenCalledWith(200);
        const payload = (json.mock.calls[0] as unknown as [{ results: Record<string, unknown> }])[0];
        expect(Object.keys(payload.results)).toEqual(['1', '2', '3']);
    });

    it('propagates per-PR failures into the results map (does not abort)', async () => {
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: true, owner: 'alice', repo: 'app' });
        mockCheckBaseConflict.mockImplementation(async (_o, _r, n) =>
            n === 2
                ? { ok: false, error: 'PR not found' }
                : { ok: true, defaultBranch: 'main', clean: true, conflicts: [], touchedByBase: [], baseLastTouched: {} },
        );

        const { req, res, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: [1, 2] });
        await checkBaseConflicts(req, res);

        const payload = (json.mock.calls[0] as unknown as [{ results: Record<string, CheckBaseConflictResult> }])[0];
        expect(payload.results['1'].ok).toBe(true);
        expect(payload.results['2'].ok).toBe(false);
    });
});
