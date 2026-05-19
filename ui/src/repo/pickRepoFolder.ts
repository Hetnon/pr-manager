export interface PickedRepo {
    handle: FileSystemDirectoryHandle;
    owner: string;
    name: string;
}

export class FolderPickError extends Error {
    constructor(message: string, public readonly cancelled = false) {
        super(message);
        this.name = 'FolderPickError';
    }
}

export function isFolderPickerSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickRepoFolder(): Promise<PickedRepo> {
    if (!isFolderPickerSupported()) {
        throw new FolderPickError("Your browser doesn't support the folder picker. Use Chrome or Edge.");
    }
    let handle: FileSystemDirectoryHandle;
    try {
        handle = await (window as unknown as {
            showDirectoryPicker: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
        }).showDirectoryPicker({ id: 'pr-matrix-repo', mode: 'read' });
    } catch (e) {
        const err = e as { name?: string; message?: string };
        if (err?.name === 'AbortError') throw new FolderPickError('Cancelled.', true);
        throw new FolderPickError(err?.message || 'Failed to open folder picker.');
    }
    const { owner, name } = await readRepoFromHandle(handle);
    return { handle, owner, name };
}

async function readRepoFromHandle(root: FileSystemDirectoryHandle): Promise<{ owner: string; name: string }> {
    let gitDir: FileSystemDirectoryHandle;
    try {
        gitDir = await root.getDirectoryHandle('.git');
    } catch {
        throw new FolderPickError(`"${root.name}" is not a git repository (no .git folder).`);
    }
    let configHandle: FileSystemFileHandle;
    try {
        configHandle = await gitDir.getFileHandle('config');
    } catch {
        throw new FolderPickError('No .git/config in the selected folder.');
    }
    const text = await (await configHandle.getFile()).text();
    const result = parseGitHubRemote(text);
    if (!result.match) {
        const found = result.remotes.length === 0
            ? 'no [remote "..."] sections found'
            : `remotes found: ${result.remotes.map((r) => `${r.name}=${r.url ?? '(no url)'}`).join(', ')}`;
        throw new FolderPickError(`No GitHub remote in .git/config (${found}).`);
    }
    return result.match;
}

export interface ParseResult {
    match: { owner: string; name: string } | null;
    remotes: { name: string; url: string | null }[];
}

export function parseGitHubRemote(configText: string): ParseResult {
    const sections: { name: string; body: string }[] = [];
    let current: { name: string; body: string } | null = null;
    for (const rawLine of configText.split(/\r?\n/)) {
        const remoteHeader = /^\s*\[remote\s+"([^"]+)"\]\s*$/.exec(rawLine);
        if (remoteHeader) {
            if (current) sections.push(current);
            current = { name: remoteHeader[1], body: '' };
            continue;
        }
        if (/^\s*\[/.test(rawLine)) {
            if (current) { sections.push(current); current = null; }
            continue;
        }
        if (current) current.body += rawLine + '\n';
    }
    if (current) sections.push(current);

    const remotes = sections.map((s) => ({
        name: s.name,
        url: /^\s*url\s*=\s*(.+?)\s*$/m.exec(s.body)?.[1] ?? null,
    }));

    const ordered = [
        ...remotes.filter((r) => r.name === 'origin'),
        ...remotes.filter((r) => r.name !== 'origin'),
    ];
    for (const r of ordered) {
        if (!r.url) continue;
        const parsed = parseGitHubUrl(r.url);
        if (parsed) return { match: parsed, remotes };
    }
    return { match: null, remotes };
}

function parseGitHubUrl(url: string): { owner: string; name: string } | null {
    // SSH host aliases (~/.ssh/config) like `github-work`, `github-nbn` are common when a user has
    // multiple GitHub identities. Accept any host containing "github" for SSH-style URLs.
    const patterns = [
        /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
        /^git@[^:]*github[^:]*:([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
        /^ssh:\/\/git@[^/]*github[^/]*\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
        /^git:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
    ];
    for (const re of patterns) {
        const m = re.exec(url.trim());
        if (m) return { owner: m[1], name: m[2] };
    }
    return null;
}
