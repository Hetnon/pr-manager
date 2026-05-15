import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import type { CheckMasterConflictResult } from '@shared/conflicts.js';

const mockGetUserToken = jest.fn() as jest.Mock<(email: string) => Promise<string | null>>;
const mockCheckMasterConflict = jest.fn() as jest.Mock<(owner: string, repo: string, prNumber: number, token: string) => Promise<CheckMasterConflictResult>>;
const mockValidateRepo = jest.fn() as jest.Mock<(repo: string, token: string) => Promise<{ ok: true; owner: string; repo: string } | { ok: false; error: string }>>;

jest.unstable_mockModule('../../../databases/databases.js', () => ({ getUserToken: mockGetUserToken }));
jest.unstable_mockModule('../../../utils/checkMasterConflict.js', () => ({ checkMasterConflict: mockCheckMasterConflict }));
jest.unstable_mockModule('../../../utils/validateRepo.js', () => ({ validateRepo: mockValidateRepo }));

const { checkMasterConflicts } = await import('./checkMasterConflicts.js');

function mockReqRes(body: Record<string, unknown>) {
    const req = { body, session: { userEmail: 'alice@example.com' } } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { req, res, status, json };
}

describe('checkMasterConflicts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects when owner is missing', async () => {
        const { req, res } = mockReqRes({ repo: 'app', prNumbers: [1] });
        await expect(checkMasterConflicts(req, res)).rejects.toThrow(/owner/);
    });

    it('rejects when repo is missing', async () => {
        const { req, res } = mockReqRes({ owner: 'alice', prNumbers: [1] });
        await expect(checkMasterConflicts(req, res)).rejects.toThrow(/repo/);
    });

    it('rejects when prNumbers is not an array', async () => {
        const { req, res } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: 'oops' });
        await expect(checkMasterConflicts(req, res)).rejects.toThrow(/prNumbers/);
    });

    it('returns 401 when the user has no stored token', async () => {
        mockGetUserToken.mockResolvedValue(null);
        const { req, res } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: [1] });
        await expect(checkMasterConflicts(req, res)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('returns 400 when validateRepo fails', async () => {
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: false, error: 'no access' });
        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: [1] });
        await checkMasterConflicts(req, res);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'no access' }));
    });

    it('checks each PR and returns a results map keyed by PR number', async () => {
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: true, owner: 'alice', repo: 'app' });
        mockCheckMasterConflict.mockImplementation(async (_o, _r, n) => ({
            ok: true,
            defaultBranch: 'main',
            clean: true,
            conflicts: [],
            touchedByMaster: [],
            masterLastTouched: {},
        } satisfies CheckMasterConflictResult & { _n?: number } as CheckMasterConflictResult));

        const { req, res, status, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: [1, 2, 3] });
        await checkMasterConflicts(req, res);

        expect(mockCheckMasterConflict).toHaveBeenCalledTimes(3);
        expect(status).toHaveBeenCalledWith(200);
        const payload = (json.mock.calls[0] as unknown as [{ results: Record<string, unknown> }])[0];
        expect(Object.keys(payload.results)).toEqual(['1', '2', '3']);
    });

    it('propagates per-PR failures into the results map (does not abort)', async () => {
        mockGetUserToken.mockResolvedValue('tok');
        mockValidateRepo.mockResolvedValue({ ok: true, owner: 'alice', repo: 'app' });
        mockCheckMasterConflict.mockImplementation(async (_o, _r, n) =>
            n === 2
                ? { ok: false, error: 'PR not found' }
                : { ok: true, defaultBranch: 'main', clean: true, conflicts: [], touchedByMaster: [], masterLastTouched: {} },
        );

        const { req, res, json } = mockReqRes({ owner: 'alice', repo: 'app', prNumbers: [1, 2] });
        await checkMasterConflicts(req, res);

        const payload = (json.mock.calls[0] as unknown as [{ results: Record<string, CheckMasterConflictResult> }])[0];
        expect(payload.results['1'].ok).toBe(true);
        expect(payload.results['2'].ok).toBe(false);
    });
});
