// Where a branch can live. Used by the delete orchestrator.
export type BranchTarget = 'local' | 'origin' | 'both';

// Per-side outcome — the orchestrator may attempt one or both sides depending
// on the target; each side reports its own result independently.
export interface BranchSideOutcome {
    attempted: boolean;
    ok: boolean;
    error?: string;
    // ok && alreadyGone === the side was already in the wanted state (no ref
    // to delete). Treated as success — the end state matches what was asked.
    alreadyGone?: boolean;
}

export interface DeleteBranchResult {
    branch: string;
    local: BranchSideOutcome;
    origin: BranchSideOutcome;
    // Local remote-tracking ref cleanup (refs/remotes/origin/<branch>). Only
    // attempted when the origin side was targeted. Best-effort; failures are
    // non-fatal and don't show up as an error to the user.
    remoteTrackingCleaned?: boolean;
}

// Server response shape for POST /api/delete-branch (origin-side only — local
// side is handled in the browser).
export interface DeleteRemoteBranchResponse {
    ok: boolean;
    error?: string;
    alreadyGone?: boolean;
}
