import type { PairwisePrConflicts } from '@shared/conflicts.js';

// State machine for the browser-side pairwise conflict computation.
export type LocalPairwiseState =
    | { phase: 'idle' }
    | { phase: 'fetching'; total: number }
    | { phase: 'computing' }
    | { phase: 'ready'; pairwise: PairwisePrConflicts; failedFetches: number[] }
    | { phase: 'no-folder' }
    | { phase: 'needs-readwrite' }
    | { phase: 'error'; message: string };

// Outcome of the most recent squash-merge attempt.
export type LastMerge =
    | null
    | { ok: true; prNumber: number; steps: string[]; branchDeleteError?: string }
    | { ok: false; prNumber: number; message: string };
