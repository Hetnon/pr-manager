import { useMemo } from 'react';
import type { PR } from '@shared/pr.js';
import { buildSharedFileMatrix } from './sharedFiles.js';
import DevActions from './DevActions.js';
import MasterCheck from './MasterCheck.js';

interface Props {
    prs: PR[];
    owner: string;
    repo: string;
    folderHandle: FileSystemDirectoryHandle | null;
    onMerged: () => void;
}

// The "PR management" view: remote work a tech lead reviews and merges. Owns the
// single canonical Matrix derived from `prs` so DevActions and MasterCheck share
// one computation instead of each calling buildMatrix independently.
export default function PrView({ prs, owner, repo, folderHandle, onMerged }: Readonly<Props>) {
    const matrix = useMemo(() => buildSharedFileMatrix(prs), [prs]);
    return (
        <>
            <DevActions matrix={matrix} />
            <MasterCheck matrix={matrix} prs={prs} owner={owner} repo={repo} folderHandle={folderHandle} onMerged={onMerged} />
        </>
    );
}
