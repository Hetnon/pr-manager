import type { CreatePrPayload, CreatePrResult } from '@shared/git.js';
import { apiFetch } from './client.js';

export function createPr(payload: CreatePrPayload): Promise<CreatePrResult> {
    return apiFetch<CreatePrResult>('/api/create-pr', { method: 'POST', body: payload });
}
