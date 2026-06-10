import type { PR } from '@shared/pr.js';

interface Props {
    nonGreens: PR[];
    promoted: Set<number>;
    onToggle: (prNumber: number, on: boolean) => void;
    conflictsByPr: Map<number, Array<{ file: string; others: number[] }>>;
    onClose: (prNumber: number) => void;
    closingPr: number | null;
}

// Lists PRs that share files with other open PRs, with a checkbox to promote one
// into the base check and a button to close it. Shown before the matrix so a
// tech lead can see exactly what they're choosing between before promoting.
export default function ConflictingPrsPanel({ nonGreens, promoted, onToggle, conflictsByPr, onClose, closingPr }: Props) {
    return (
        <div style={{
            margin: '12px 0', padding: '12px 14px', background: '#fffbe6',
            border: '1px solid #d4a72c', borderRadius: 6,
        }}>
            <strong style={{ fontSize: 14 }}>Conflicting PRs ({nonGreens.length})</strong>
            <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#57606a' }}>
                These share files with other open PRs. Promote one (or more) to evaluate against the base branch.
                If clean, you can squash-merge it below; then refresh to re-check the rest.
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {nonGreens.map((pr) => {
                    const conflicts = conflictsByPr.get(pr.number) ?? [];
                    const isPromoted = promoted.has(pr.number);
                    return (
                        <li key={pr.number} style={{
                            padding: '8px 0',
                            borderTop: '1px solid rgba(212, 167, 44, 0.3)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', flex: 1 }}>
                                    <input
                                        type="checkbox"
                                        checked={isPromoted}
                                        onChange={(event) => onToggle(pr.number, event.target.checked)}
                                        style={{ marginTop: 3 }}
                                    />
                                    <div style={{ flex: 1, fontSize: 13 }}>
                                        <div>
                                            <a href={pr.url} target="_blank" rel="noreferrer"><strong>#{pr.number}</strong></a>
                                            {' '}— {pr.title}{' '}
                                            <span style={{ color: '#8c959f' }}>({pr.author.login} · <code>{pr.headRefName}</code>)</span>
                                            {isPromoted && (
                                                <span style={{ marginLeft: 8, fontSize: 11, color: '#1a7f37', fontWeight: 600 }}>
                                                    ✓ promoted
                                                </span>
                                            )}
                                        </div>
                                        <ul style={{ margin: '4px 0 0 0', paddingLeft: 16, fontSize: 12, color: '#57606a' }}>
                                            {conflicts.map(({ file, others }) => (
                                                <li key={file}>
                                                    <code>{file}</code> — also in {others.map((otherPrNumber) => `#${otherPrNumber}`).join(', ')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => onClose(pr.number)}
                                    disabled={closingPr !== null}
                                    title="Close this PR without merging (reopenable on GitHub)"
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    {closingPr === pr.number ? 'Closing…' : 'Close PR'}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
