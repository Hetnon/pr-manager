// Envelope encryption for per-user secrets.
//
// Pattern:
//   1. Generate a random Data Encryption Key (DEK) for each payload.
//   2. Encrypt the payload locally with AES-256-GCM using the DEK.
//   3. Wrap (encrypt) the DEK by calling Google Cloud KMS.
//   4. Store {encryptedPayload, wrappedDek, kmsKeyName} together.
//
// To decrypt: unwrap the DEK via KMS, then locally AES-GCM-decrypt the payload.
//
// Why: Firestore is encrypted at rest by Google with Google-managed keys, but
// if a DB credential ever leaks, raw read access would expose stored secrets.
// With envelope encryption, an attacker also needs KMS access — which is
// audit-logged and IAM-scoped separately.

import crypto from 'node:crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';

const kmsClient = new KeyManagementServiceClient();

export interface EnvelopeCipher {
    encryptedPayload: string;  // base64 of (iv || tag || ciphertext)
    wrappedDek: string;        // base64 of KMS-wrapped DEK
    kmsKeyName: string;        // full KMS key resource name used to wrap
}

const AES_KEY_BYTES = 32;   // AES-256
const IV_BYTES = 12;        // GCM standard
const TAG_BYTES = 16;       // GCM standard

function requireKmsKeyName(): string {
    const name = process.env.KMS_KEY_NAME;
    if (!name) {
        throw Object.assign(
            new Error('KMS_KEY_NAME env var is required for envelope encryption. Format: projects/PROJECT/locations/LOC/keyRings/RING/cryptoKeys/KEY'),
            { statusCode: 500 },
        );
    }
    return name;
}

export async function encryptEnvelope(plaintext: string): Promise<EnvelopeCipher> {
    const kmsKeyName = requireKmsKeyName();

    const dek = crypto.randomBytes(AES_KEY_BYTES);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encryptedPayload = Buffer.concat([iv, tag, ciphertext]).toString('base64');

    const [result] = await kmsClient.encrypt({ name: kmsKeyName, plaintext: dek });
    const wrappedDek = Buffer.from(result.ciphertext as Uint8Array).toString('base64');

    // Zero the DEK from memory ASAP — best effort.
    dek.fill(0);

    return { encryptedPayload, wrappedDek, kmsKeyName };
}

export async function decryptEnvelope(cipher: EnvelopeCipher): Promise<string> {
    const [result] = await kmsClient.decrypt({
        name: cipher.kmsKeyName,
        ciphertext: Buffer.from(cipher.wrappedDek, 'base64'),
    });
    const dek = Buffer.from(result.plaintext as Uint8Array);

    try {
        const data = Buffer.from(cipher.encryptedPayload, 'base64');
        const iv = data.subarray(0, IV_BYTES);
        const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
        const ciphertext = data.subarray(IV_BYTES + TAG_BYTES);

        const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return plaintext.toString('utf8');
    } finally {
        dek.fill(0);
    }
}
