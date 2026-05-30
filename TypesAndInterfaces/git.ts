// Payload for POST /api/create-pr. owner/repo identify the GitHub repo; head is
// the branch with the new commits; base is the target branch (usually master/main).
export interface CreatePrPayload {
    owner: string;
    repo: string;
    head: string;
    base: string;
    title: string;
    body?: string;
    draft?: boolean;
}

export interface CreatePrResult {
    number: number;
    url: string;
}

// Result of POST /api/close-pr. GitHub has no "delete PR" — closing is the
// equivalent (disregard without merging; reopenable on GitHub).
export type ClosePrResult =
    | { ok: true; number: number }
    | { ok: false; error: string };
