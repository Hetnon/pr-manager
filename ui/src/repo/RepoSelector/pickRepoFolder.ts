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



export async function pickRepoFolder(): Promise<PickedRepo> {

    let handle: FileSystemDirectoryHandle;
    try {
        handle = await (globalThis as unknown as {
            showDirectoryPicker: (opts?: { id?: string; mode?: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
        }).showDirectoryPicker({ id: 'pr-matrix-repo', mode: 'readwrite' });
    } catch (error) {
        const errorInfo = error as { name?: string; message?: string };
        if (errorInfo?.name === 'AbortError') throw new FolderPickError('Cancelled.', true);
        throw new FolderPickError(errorInfo?.message || 'Failed to open folder picker.');
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
            : `remotes found: ${result.remotes.map((remote) => `${remote.name}=${remote.url ?? '(no url)'}`).join(', ')}`;
        throw new FolderPickError(`No GitHub remote in .git/config (${found}).`);
    }
    return result.match;
}

interface ParseResult {
    match: { owner: string; name: string } | null;
    remotes: { name: string; url: string | null }[];
}

function parseGitHubRemote(configText: string): ParseResult {
    const sections: { name: string; body: string }[] = [];
    let currentSection: { name: string; body: string } | null = null;
    
    for (const rawLine of configText.split(/\r?\n/)) {
        //loop all the config lines and parse them into sections
        const remoteHeader = /^\s*\[remote\s+"([^"]+)"\]\s*$/.exec(rawLine);
        if (remoteHeader) {
            if (currentSection) sections.push(currentSection);
            currentSection = { name: remoteHeader[1], body: '' };
            continue;
        }
        const sessionHeader = /^\s*\[/.test(rawLine);
        if (sessionHeader) {
            if (currentSection) { 
                sections.push(currentSection); 
                currentSection = null; 
            }
            continue;
        }

        if (currentSection) currentSection.body += rawLine + '\n';
    }

    if (currentSection) sections.push(currentSection);

    const remotes = sections.map((section) => ({
        name: section.name,
        url: /^\s*url\s*=\s*(.+?)\s*$/m.exec(section.body)?.[1] ?? null,
    }));

    const ordered = [
        ...remotes.filter((remote) => remote.name === 'origin'),
        ...remotes.filter((remote) => remote.name !== 'origin'),
    ];
    for (const remote of ordered) {
        if (!remote.url) continue;
        const parsed = parseGitHubUrl(remote.url);
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
    for (const pattern of patterns) {
        const match = pattern.exec(url.trim());
        if (match) return { owner: match[1], name: match[2] };
    }
    return null;
}
