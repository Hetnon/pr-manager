import type { Request, Response } from 'express';
import { requireParam, throwValidationError } from '../../../utils/requireParam/requireParam.js';
import {
    getUserByGithubId,
    createUserDB,
    updateUserFields,
    storeUserToken,
} from '../../../databases/databases.js';
import { includeUserInfoToSession } from '../../../expressSession/expressSession.js';
import { verifyOauthState } from '../oauthState.js';

interface GithubTokenResponse {
    access_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
}

interface GithubUserResponse {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
    avatar_url: string;
}

interface GithubEmail {
    email: string;
    primary: boolean;
    verified: boolean;
}

interface ExistingUser {
    userEmail: string;
    userType?: string;
    [key: string]: unknown;
}

/**
 * GET /api/auth/github/callback?code=...&state=...
 * Browser redirects here after the user authorizes the OAuth App on GitHub.
 * Exchanges the code, fetches user info, upserts the user, stores the token,
 * sets the session, then redirects back to the app.
 */
export async function githubCallback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    requireParam(code, 'OAuth code is required');
    requireParam(state, 'OAuth state is required');

    if (!verifyOauthState(state!)) {
        throwValidationError('OAuth state invalid or expired — start sign-in again');
    }

    // 1. Exchange code → access_token
    const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: process.env.GITHUB_REDIRECT_URI,
        }),
    });
    const tokenData = (await tokenResp.json()) as GithubTokenResponse;
    if (!tokenData.access_token) {
        throw Object.assign(
            new Error(`GitHub token exchange failed: ${tokenData.error_description ?? tokenData.error ?? 'unknown error'}`),
            { statusCode: 502 },
        );
    }
    const accessToken = tokenData.access_token;
    const grantedScopes = (tokenData.scope ?? '').split(',').map((s) => s.trim()).filter(Boolean);

    // 2. Fetch user info
    const ghUser = await fetchGithubUser(accessToken);
    const userEmail = ghUser.email ?? (await fetchPrimaryEmail(accessToken));
    if (!userEmail) {
        throw Object.assign(new Error('Could not determine a verified email for this GitHub account'), { statusCode: 400 });
    }

    // 3. Upsert user (look up by githubId so a changed email still finds them)
    const existing = (await getUserByGithubId(ghUser.id)) as ExistingUser | null;
    const recordEmail = existing?.userEmail ?? userEmail;
    if (existing) {
        await updateUserFields(recordEmail, {
            githubLogin: ghUser.login,
            name: ghUser.name ?? '',
            avatarUrl: ghUser.avatar_url,
            lastLogin: new Date().toISOString(),
        });
    } else {
        await createUserDB({
            userEmail,
            githubLogin: ghUser.login,
            githubId: ghUser.id,
            name: ghUser.name ?? '',
            avatarUrl: ghUser.avatar_url,
        });
    }

    // 4. Store the OAuth token (envelope-encrypted)
    await storeUserToken(recordEmail, accessToken, grantedScopes);

    // 5. Set session
    await includeUserInfoToSession(req, recordEmail, existing?.userType ?? 'user', 'active');

    // 6. Redirect back to the app
    const redirectAfterLogin = process.env.POST_LOGIN_REDIRECT ?? '/';
    res.redirect(redirectAfterLogin);
}

async function fetchGithubUser(accessToken: string): Promise<GithubUserResponse> {
    const resp = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) {
        throw Object.assign(new Error(`Failed to fetch GitHub user: ${resp.status}`), { statusCode: 502 });
    }
    return (await resp.json()) as GithubUserResponse;
}

async function fetchPrimaryEmail(accessToken: string): Promise<string | null> {
    const resp = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) return null;
    const emails = (await resp.json()) as GithubEmail[];
    const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
    return primary?.email ?? null;
}
