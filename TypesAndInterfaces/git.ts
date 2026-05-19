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
