import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockAccessSecretVersion = jest.fn();
const mockSecretManagerServiceClient = jest.fn(() => ({
    accessSecretVersion: mockAccessSecretVersion,
}));

jest.unstable_mockModule('@google-cloud/secret-manager', () => ({
    SecretManagerServiceClient: mockSecretManagerServiceClient,
}));

process.env.GOOGLE_PROJECT_ID = 'test-project';

const {
    loadSecrets,
    firebaseKey,
    pdfKey,
    googleCloudStorageKey,
    _resetSecretStateForTests,
} = await import('./secretManager.js');

function asSecretPayload(value: unknown): [{ payload: { data: Buffer } }] {
    return [{ payload: { data: Buffer.from(JSON.stringify(value), 'utf8') } }];
}

describe('secretManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        _resetSecretStateForTests();
    });

    it('throws from getters before loadSecrets', () => {
        expect(() => firebaseKey()).toThrow('Firebase key has not been loaded');
        expect(() => pdfKey()).toThrow('PDF Services key has not been loaded');
        expect(() => googleCloudStorageKey()).toThrow('Google Cloud Storage key has not been loaded');
    });

    it('loads secrets and exposes parsed keys', async () => {
        mockAccessSecretVersion
            .mockResolvedValueOnce(asSecretPayload({ OPEN_AI_API_KEY: 'k1', OPEN_AI_ORGANIZATION_ID: 'org' }))
            .mockResolvedValueOnce(asSecretPayload({ client_credentials: { client_id: 'id' } }))
            .mockResolvedValueOnce(asSecretPayload({ type: 'service_account', project_id: 'demo' }))
            .mockResolvedValueOnce(asSecretPayload({ project_id: 'storage-proj' }));

        await loadSecrets();

        expect(process.env.OPEN_AI_API_KEY).toBe('k1');
        expect(process.env.OPEN_AI_ORGANIZATION_ID).toBe('org');
        expect(pdfKey()).toEqual({ client_credentials: { client_id: 'id' } });
        expect(firebaseKey()).toEqual({ type: 'service_account', project_id: 'demo' });
        expect(googleCloudStorageKey()).toEqual({ project_id: 'storage-proj' });
        expect(mockAccessSecretVersion).toHaveBeenCalledTimes(4);
    });
});
