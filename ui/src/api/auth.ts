import { apiFetch } from './client.js';

export interface SessionInfo {
    loggedIn: boolean;
    token?: string;
}

interface SessionResponse {
    responseObject: SessionInfo;
}

export async function checkSession(): Promise<SessionInfo> {
    const data = await apiFetch<SessionResponse>('/api/check-user-session');
    return data.responseObject;
}

export async function initiateGithubLogin(): Promise<string> {
    const data = await apiFetch<{ url: string }>('/api/auth/github/login', { method: 'POST' });
    return data.url;
}

export async function logout(): Promise<void> {
    await apiFetch('/api/terminate-session', { method: 'POST' });
}
