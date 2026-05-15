// Stateless OAuth state token for the GitHub round-trip.
//
// Why: a session-cookie-backed state would require sameSite=lax/none so the
// cookie survives the github.com → /api/auth/github/callback redirect (it
// won't survive strict). This module sidesteps the cookie entirely by making
// the state self-verifying: the token carries its own HMAC and timestamp.
//
// Layout (raw bytes, base64url-encoded):
//   [16 bytes random nonce] [8 bytes BE timestamp ms] [32 bytes HMAC-SHA256]
// HMAC is over (nonce || ts), keyed with SESSION_SECRET.

import crypto from 'node:crypto';

const NONCE_BYTES = 16;
const TS_BYTES = 8;
const HMAC_BYTES = 32;
const TOTAL_BYTES = NONCE_BYTES + TS_BYTES + HMAC_BYTES;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function key(): Buffer {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        throw Object.assign(new Error('SESSION_SECRET is required for OAuth state generation'), { statusCode: 500 });
    }
    return Buffer.from(secret);
}

export function generateOauthState(): string {
    const nonce = crypto.randomBytes(NONCE_BYTES);
    const ts = Buffer.alloc(TS_BYTES);
    ts.writeBigUInt64BE(BigInt(Date.now()));
    const hmac = crypto.createHmac('sha256', key()).update(Buffer.concat([nonce, ts])).digest();
    return Buffer.concat([nonce, ts, hmac]).toString('base64url');
}

export function verifyOauthState(state: string): boolean {
    try {
        const buf = Buffer.from(state, 'base64url');
        if (buf.length !== TOTAL_BYTES) return false;

        const nonce = buf.subarray(0, NONCE_BYTES);
        const ts = buf.subarray(NONCE_BYTES, NONCE_BYTES + TS_BYTES);
        const sig = buf.subarray(NONCE_BYTES + TS_BYTES);

        const expected = crypto.createHmac('sha256', key()).update(Buffer.concat([nonce, ts])).digest();
        if (!crypto.timingSafeEqual(sig, expected)) return false;

        const timestamp = Number(ts.readBigUInt64BE());
        if (Date.now() - timestamp > TTL_MS) return false;

        return true;
    } catch {
        return false;
    }
}
