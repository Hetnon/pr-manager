import type { SessionInfo, SessionResponse } from '@shared/session.js';
import { apiFetch } from './client.js';

export async function apiCheckSession(): Promise<SessionInfo> {
    const data = await apiFetch<SessionResponse>('/api/check-user-session');
    return data.responseObject;
}

export async function initiateGithubLogin(): Promise<string> {
    const data = await apiFetch<{ url: string }>('/api/auth/github/login', { method: 'POST' });
    return data.url;
}

export async function apiLogout(): Promise<void> {
    await apiFetch('/api/terminate-session', { method: 'POST' });
}
