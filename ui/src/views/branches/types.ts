import type { PR } from '@shared/pr.js';
import type { LocalBranch } from './readLocalRepo.js';

// Outcome of pushing a local branch to origin (backup — no PR). `updatedPr` is
// set when the pushed branch had an open PR, which the push necessarily updates.
export type PushOutcome =
    | { ok: true; branch: string; updatedPr?: { number: number; url: string } }
    | { ok: false; branch: string; message: string };

// Outcome of pushing a branch and opening its PR.
export type PrOutcome =
    | { ok: true; branch: string; prNumber: number; prUrl: string }
    | { ok: false; branch: string; message: string };

// One row of the branch list: a local branch and its matching open PR (if any).
export interface Row {
    branch: LocalBranch;
    pr: PR | null;
}
