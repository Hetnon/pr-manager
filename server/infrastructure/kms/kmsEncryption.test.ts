import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockEncrypt = jest.fn() as jest.Mock<(arg: { name: string; plaintext: Buffer }) => Promise<[{ ciphertext: Buffer }]>>;
const mockDecrypt = jest.fn() as jest.Mock<(arg: { name: string; ciphertext: Buffer }) => Promise<[{ plaintext: Buffer }]>>;

jest.unstable_mockModule('@google-cloud/kms', () => ({
    KeyManagementServiceClient: jest.fn().mockImplementation(() => ({
        encrypt: mockEncrypt,
        decrypt: mockDecrypt,
    })),
}));

// Import after mocking so kmsEncryption.ts picks up the mock.
const { encryptEnvelope, decryptEnvelope } = await import('./kmsEncryption.js');

const KMS_KEY = 'projects/test/locations/global/keyRings/r/cryptoKeys/k';

// Fake KMS wrap: prepend a sentinel; unwrap strips it.
const SENTINEL = Buffer.from('KMS:');

describe('kmsEncryption', () => {
    let originalKeyName: string | undefined;

    beforeEach(() => {
        originalKeyName = process.env.KMS_KEY_NAME;
        process.env.KMS_KEY_NAME = KMS_KEY;
        jest.clearAllMocks();

        mockEncrypt.mockImplementation(async ({ plaintext }) => [{
            ciphertext: Buffer.concat([SENTINEL, plaintext]),
        }]);
        mockDecrypt.mockImplementation(async ({ ciphertext }) => [{
            plaintext: Buffer.from(ciphertext).subarray(SENTINEL.length),
        }]);
    });

    afterEach(() => {
        if (originalKeyName !== undefined) process.env.KMS_KEY_NAME = originalKeyName;
        else delete process.env.KMS_KEY_NAME;
    });

    it('round-trips plaintext back to its original value', async () => {
        const plaintext = 'gho_pretend_github_token_value_1234';
        const cipher = await encryptEnvelope(plaintext);
        const recovered = await decryptEnvelope(cipher);
        expect(recovered).toBe(plaintext);
    });

    it('returns all three envelope components', async () => {
        const cipher = await encryptEnvelope('x');
        expect(cipher.encryptedPayload).toBeTruthy();
        expect(cipher.wrappedDek).toBeTruthy();
        expect(cipher.kmsKeyName).toBe(KMS_KEY);
    });

    it('produces unique ciphertexts for the same plaintext (fresh IV + DEK)', async () => {
        const plaintext = 'same-input-twice';
        const a = await encryptEnvelope(plaintext);
        const b = await encryptEnvelope(plaintext);
        expect(a.encryptedPayload).not.toBe(b.encryptedPayload);
        expect(a.wrappedDek).not.toBe(b.wrappedDek);
    });

    it('rejects tampered ciphertext via AES-GCM auth tag', async () => {
        const cipher = await encryptEnvelope('secret');
        const buf = Buffer.from(cipher.encryptedPayload, 'base64');
        buf[buf.length - 1] ^= 0xff;
        const tampered = { ...cipher, encryptedPayload: buf.toString('base64') };
        await expect(decryptEnvelope(tampered)).rejects.toThrow();
    });

    it('rejects ciphertext whose wrapped DEK fails to unwrap', async () => {
        const cipher = await encryptEnvelope('secret');
        mockDecrypt.mockRejectedValueOnce(new Error('KMS permission denied'));
        await expect(decryptEnvelope(cipher)).rejects.toThrow(/KMS permission denied/);
    });

    it('throws when KMS_KEY_NAME is missing', async () => {
        delete process.env.KMS_KEY_NAME;
        await expect(encryptEnvelope('x')).rejects.toThrow(/KMS_KEY_NAME/);
    });

    it('asks KMS to encrypt with the configured key name', async () => {
        await encryptEnvelope('x');
        expect(mockEncrypt).toHaveBeenCalledTimes(1);
        const arg = mockEncrypt.mock.calls[0][0];
        expect(arg.name).toBe(KMS_KEY);
        expect(arg.plaintext).toBeInstanceOf(Buffer);
        expect(arg.plaintext.length).toBe(32); // 256-bit DEK
    });

    it('asks KMS to decrypt with the stored key name from the envelope', async () => {
        const cipher = await encryptEnvelope('x');
        await decryptEnvelope(cipher);
        const arg = mockDecrypt.mock.calls[0][0];
        expect(arg.name).toBe(cipher.kmsKeyName);
    });

    it('supports non-ASCII plaintext', async () => {
        const plaintext = '🔐 GitHub token with émojis & unicode';
        const cipher = await encryptEnvelope(plaintext);
        const recovered = await decryptEnvelope(cipher);
        expect(recovered).toBe(plaintext);
    });
});
