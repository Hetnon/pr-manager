export type MergeStrategy = 'merge' | 'squash' | 'rebase';

export type MergePrResult =
  | { ok: false; error: string }
  | { ok: false; preflight: 'wrong-branch'; currentBranch: string | null; defaultBranch: string }
  | { ok: false; preflight: 'dirty-tree'; defaultBranch: string }
  | { ok: true; defaultBranch: string; steps: string[] };
