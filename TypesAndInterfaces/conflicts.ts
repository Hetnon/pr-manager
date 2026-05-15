export interface MasterTouch {
  sha: string;
  date: string;
  subject: string;
}

export type CheckMasterConflictResult =
  | { ok: false; error: string }
  | {
      ok: true;
      defaultBranch: string;
      clean: boolean;
      conflicts: string[];
      touchedByMaster: string[];
      masterLastTouched: Record<string, MasterTouch>;
    };
