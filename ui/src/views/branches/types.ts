import type { PR } from '@shared/pr.js';
import type { LocalBranch } from './readLocalRepo.js';

// Outcome of pushing a local branch and opening its PR.
export type PushOutcome =
    | { ok: true; branch: string; prNumber: number; prUrl: string }
    | { ok: false; branch: string; message: string };

// One row of the branch list: a local branch and its matching open PR (if any).
export interface Row {
    branch: LocalBranch;
    pr: PR | null;
}
