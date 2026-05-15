import type { Request, Response } from 'express';
import { requireParam } from '../../utils/requireParam/requireParam.js';
import { generateOauthState } from './oauthState.js';

/**
 * POST /api/auth/github/login
 * Returns a GitHub authorize URL the client should redirect the user to.
 * Uses a stateless, HMAC-signed `state` so the github.com → callback redirect
 * doesn't need the session cookie to survive cross-site delivery.
 */
export async function githubLogin(_req: Request, res: Response): Promise<void> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    const scopes = process.env.GITHUB_OAUTH_SCOPES ?? 'repo read:user user:email';

    requireParam(clientId, 'GITHUB_CLIENT_ID env var is required');
    requireParam(redirectUri, 'GITHUB_REDIRECT_URI env var is required');

    const state = generateOauthState();

    const params = new URLSearchParams({
        client_id: clientId!,
        redirect_uri: redirectUri!,
        scope: scopes,
        state,
        allow_signup: 'true',
    });

    res.status(200).json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
}
