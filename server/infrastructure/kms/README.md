# infrastructure/kms

Envelope encryption for per-user secrets (currently GitHub OAuth tokens).

## What it does

`encryptEnvelope(plaintext)` returns `{ encryptedPayload, wrappedDek, kmsKeyName }`:

1. Generates a random 32-byte **Data Encryption Key (DEK)** per call.
2. Encrypts the plaintext locally with **AES-256-GCM** (12-byte random IV).
   The output is `iv ‖ tag ‖ ciphertext`, base64-encoded.
3. **Wraps the DEK** by calling Google Cloud KMS `encrypt` on the key identified by `KMS_KEY_NAME`.
4. Returns all three pieces. The caller stores them together; only the wrapped DEK depends on KMS.

`decryptEnvelope(cipher)` reverses it: KMS `decrypt` unwraps the DEK, AES-GCM verifies the tag and decrypts the payload, plaintext is returned.

## Why this shape

Firestore is encrypted at rest by Google with Google-managed keys, but those don't protect against a credentials leak that gives someone read access to the database. With envelope encryption, the stored payload is useless without KMS access — which is IAM-scoped separately and produces audit logs on every decrypt.

Per-call DEKs are also cheap (`crypto.randomBytes(32)`) and avoid the multi-MB cost limit of asking KMS to encrypt the payload directly.

## Required env

- `KMS_KEY_NAME` — full key resource name, e.g.
  `projects/PROJECT/locations/global/keyRings/pr-matrix-keys/cryptoKeys/tokens`

Created by `scripts/gcp-bootstrap.js`.
