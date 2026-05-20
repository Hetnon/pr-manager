import { useEffect, useState, type CSSProperties } from 'react';
import { queryFolderPermission, requestFolderReadWrite, type FolderPermLevel } from './folderPermission.js';

interface Props {
    handle: FileSystemDirectoryHandle | null;
    onChange?: (level: FolderPermLevel) => void;
}

export default function RepoPermissionBadge({ handle, onChange }: Props) {
    const [level, setLevel] = useState<FolderPermLevel | null>(null);
    const [busy, setBusy] = useState(false);

    // Passive query on mount/handle change. Does NOT fire onChange — discovery
    // isn't a change, and the parent's onChange typically triggers a refresh,
    // which would race with the parent's own mount-time refresh.
    useEffect(() => {
        if (!handle) { setLevel(null); return; }
        let cancelled = false;
        void queryFolderPermission(handle).then((l) => {
            if (!cancelled) setLevel(l);
        });
        return () => { cancelled = true; };
    }, [handle]);

    // User-initiated upgrade. THIS is where onChange fires — a real state
    // transition the parent should react to.
    async function upgrade() {
        if (!handle) return;
        setBusy(true);
        try {
            const next = await requestFolderReadWrite(handle);
            setLevel(next);
            onChange?.(next);
        } finally { setBusy(false); }
    }

    if (!handle) return null;
    if (level === null) {
        return <span style={chipStyle('loading')}>checking…</span>;
    }

    const { label, title } = describe(level);
    const canUpgrade = level === 'read' || level === 'none';

    return (
        <button
            type="button"
            onClick={canUpgrade ? () => void upgrade() : undefined}
            disabled={busy || !canUpgrade}
            title={title}
            style={chipStyle(level, busy, canUpgrade)}
        >
            {busy ? 'asking…' : label}
        </button>
    );
}

function describe(level: FolderPermLevel): { label: string; title: string } {
    if (level === 'readwrite') {
        return { label: 'rw', title: 'Folder access: read + write. Push/fetch enabled.' };
    }
    if (level === 'read') {
        return { label: 'ro', title: 'Folder access: read only. Click to allow writes (needed for push/fetch).' };
    }
    if (level === 'none') {
        return { label: 'no access', title: 'No folder access. Click to grant, or pick the folder again.' };
    }
    return { label: '?', title: "Browser doesn't expose permission state for this handle." };
}

function chipStyle(level: FolderPermLevel | 'loading', busy?: boolean, clickable?: boolean): CSSProperties {
    const palette = {
        readwrite: { bg: '#dafbe1', border: '#1f883d', color: '#1a7f37' },
        read:      { bg: '#fff8c5', border: '#d4a72c', color: '#9a6700' },
        none:      { bg: '#ffebe9', border: '#cf222e', color: '#cf222e' },
        unknown:   { bg: '#f6f8fa', border: '#d0d7de', color: '#57606a' },
        loading:   { bg: '#f6f8fa', border: '#d0d7de', color: '#57606a' },
    } as const;
    const p = palette[level];
    return {
        background: p.bg,
        border: `1px solid ${p.border}`,
        color: p.color,
        borderRadius: 12,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'inherit',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        cursor: busy ? 'wait' : clickable ? 'pointer' : 'default',
    };
}
