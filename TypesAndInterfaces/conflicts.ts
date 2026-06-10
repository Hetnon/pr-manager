export interface BaseTouch {
  sha: string;
  date: string;
  subject: string;
}

export type CheckBaseConflictResult =
  | { ok: false; error: string }
  | {
      ok: true;
      defaultBranch: string;
      clean: boolean;
      conflicts: string[];
      touchedByBase: string[];
      baseLastTouched: Record<string, BaseTouch>;
    };

// Per-file conflict severity. Shared by both the local-branch matrix and the
// PR matrix — same semantics for both, only the source data differs.
export type FileSeverity = 'safe' | 'warning' | 'conflict';

// A group of PRs that share the exact same HEAD sha. They're proposing
// identical commits — one is enough; the rest are candidates for closing.
export interface PrGroup {
  sha: string;
  prNumbers: number[];  // sorted ascending; all PRs at this sha
  canonical: number;    // lowest PR number — represents the group in analysis
}

// Pairwise PR-to-PR conflict data. Computed server-side from GitHub's per-PR
// patch strings (no blob reads needed). Only canonical PRs participate.
export interface PairwisePrConflicts {
  prGroups: PrGroup[];
  // Per-file severity when 2+ canonical PRs touch the same file. Files only
  // touched by one PR are 'safe'. Files we can't analyze (binary, no patch)
  // are 'warning' (conservative).
  fileSeverity: Record<string, FileSeverity>;
}

// Top-level response of POST /api/base-conflicts. Pairwise PR-to-PR data is
// no longer returned here — the browser computes it locally via isomorphic-git
// using fetched PR refs.
export interface CheckConflictsResponse {
  results: Record<string, CheckBaseConflictResult>;
}
