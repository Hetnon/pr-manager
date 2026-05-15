import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { requireParam } from '../../../utils/requireParam/requireParam.js';

/**
 * POST /api/auth/github/login
 * Returns a GitHub authorize URL the client should redirect the user to.
 * Stores a random `state` in the session for CSRF validation on callback.
 */
export async function githubLogin(req: Request, res: Response): Promise<void> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    const scopes = process.env.GITHUB_OAUTH_SCOPES ?? 'repo read:user user:email';

    requireParam(clientId, 'GITHUB_CLIENT_ID env var is required');
    requireParam(redirectUri, 'GITHUB_REDIRECT_URI env var is required');

    const state = crypto.randomBytes(32).toString('hex');
    req.session.oauthState = state;
    await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
    });

    const params = new URLSearchParams({
        client_id: clientId!,
        redirect_uri: redirectUri!,
        scope: scopes,
        state,
        allow_signup: 'true',
    });

    res.status(200).json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
}
