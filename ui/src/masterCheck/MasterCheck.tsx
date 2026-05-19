import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import type { CheckConflictsResponse, MasterTouch, PairwisePrConflicts, PrGroup } from '@shared/conflicts.js';
import type { MergePrResult } from '@shared/merge.js';
import { buildMatrix } from '../lib/matrix.js';
import { checkMasterConflicts as apiCheckConflicts, mergePr as apiMergePr } from '../api/prs.js';
import { fetchPrRefs } from './fetchPrRefs.js';
import { computeBrowserPairwise } from './computeBrowserPairwise.js';
import { queryFolderPermission } from '../repo/folderPermission.js';
import PrMatrix from '../prMatrix/PrMatrix.js';
import type { CellState } from '../prMatrix/PrMatrixBody.js';
import styles from './MasterCheck.module.css';

function formatRelativeShort(iso: string | undefined): string {
    if (!iso) return '';
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1d';
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${Math.round(days / 365)}y`;
}

interface Props {
    prs: PR[];
    owner: string;
    repo: string;
    folderHandle: FileSystemDirectoryHandle | null;
    onMerged?: () => void;
}

type LocalPairwiseState =
    | { phase: 'idle' }
    | { phase: 'fetching'; total: number }
    | { phase: 'computing' }
    | { phase: 'ready'; pairwise: PairwisePrConflicts; failedFetches: number[] }
    | { phase: 'no-folder' }
    | { phase: 'needs-readwrite' }
    | { phase: 'error'; message: string };

type LastMerge =
    | null
    | { ok: true; prNumber: number; steps: string[]; branchDeleteError?: string }
    | { ok: false; prNumber: number; message: string };

interface ConflictingPrsPanelProps {
    nonGreens: PR[];
    promoted: Set<number>;
    onToggle: (prNumber: number, on: boolean) => void;
    conflictsByPr: Map<number, Array<{ file: string; others: number[] }>>;
}

function ConflictingPrsPanel({ nonGreens, promoted, onToggle, conflictsByPr }: ConflictingPrsPanelProps) {
    return (
        <div style={{
            margin: '12px 0', padding: '12px 14px', background: '#fffbe6',
            border: '1px solid #d4a72c', borderRadius: 6,
        }}>
            <strong style={{ fontSize: 14 }}>Conflicting PRs ({nonGreens.length})</strong>
            <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#57606a' }}>
                These share files with other open PRs. Promote one (or more) to evaluate against master.
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
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isPromoted}
                                    onChange={(e) => onToggle(pr.number, e.target.checked)}
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
                                                <code>{file}</code> — also in {others.map((n) => `#${n}`).join(', ')}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </label>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function LocalPairwiseStatus({ state }: { state: LocalPairwiseState }) {
    if (state.phase === 'idle' || state.phase === 'ready') {
        if (state.phase === 'ready' && state.failedFetches.length > 0) {
            return (
                <p style={{ margin: '6px 0', fontSize: 12, color: '#9a6700' }}>
                    ⚠ Couldn't fetch PR refs for: {state.failedFetches.map((n) => `#${n}`).join(', ')} —
                    pairwise will fall back to conservative warning for files those PRs touch.
                </p>
            );
        }
        return null;
    }
    if (state.phase === 'no-folder') {
        return (
            <p style={{ margin: '6px 0', fontSize: 12, color: '#9a6700' }}>
                Pick a local folder of this repo to enable real pairwise conflict detection.
            </p>
        );
    }
    if (state.phase === 'needs-readwrite') {
        return (
            <p style={{ margin: '6px 0', fontSize: 12, color: '#9a6700' }}>
                Pairwise check needs read+write folder access — click the RW badge in the header to grant.
            </p>
        );
    }
    if (state.phase === 'fetching') {
        return <p style={{ margin: '6px 0', fontSize: 12, color: '#57606a' }}>Fetching {state.total} PR ref(s) via proxy…</p>;
    }
    if (state.phase === 'computing') {
        return <p style={{ margin: '6px 0', fontSize: 12, color: '#57606a' }}>Running 3-way merge per shared file…</p>;
    }
    return <p style={{ margin: '6px 0', fontSize: 12, color: '#cf222e' }}>Pairwise check failed: {state.message}</p>;
}

function PrDuplicatesBanner({ groups }: { groups: PrGroup[] }) {
    const dupes = groups.filter((g) => g.prNumbers.length > 1);
    if (dupes.length === 0) return null;
    const totalRedundant = dupes.reduce((n, g) => n + g.prNumbers.length - 1, 0);
    return (
        <div style={{ margin: '8px 0', padding: '8px 12px', background: '#fff8c5', border: '1px solid #d4a72c', borderRadius: 4, fontSize: 13 }}>
            <strong>⚠ {dupes.length} group{dupes.length === 1 ? '' : 's'} of identical PRs</strong> ({totalRedundant} redundant). Same HEAD sha — consider closing all but one:
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                {dupes.map((g) => (
                    <li key={g.sha} style={{ marginBottom: 2 }}>
                        At <code>{g.sha.slice(0, 8)}</code>: {g.prNumbers.map((n, i) => (
                            <span key={n}>
                                #{n}{i === 0 ? ' (keep)' : ''}
                                {i < g.prNumbers.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function MasterCheck({ prs, owner, repo, folderHandle, onMerged }: Props) {
    const { sortedPrs, prSafe } = useMemo(() => buildMatrix(prs), [prs]);
    const greens = useMemo(() => sortedPrs.filter((pr) => prSafe.get(pr.number)), [sortedPrs, prSafe]);
    const nonGreens = useMemo(() => sortedPrs.filter((pr) => !prSafe.get(pr.number)), [sortedPrs, prSafe]);

    // Per-PR map of "files this PR shares with other PRs" — drives the
    // intermediate "Conflicting PRs" panel so a tech lead can see exactly what
    // they're choosing about before promoting.
    const conflictsByPr = useMemo(() => {
        const fileToAllPrs = new Map<string, number[]>();
        for (const pr of prs) {
            for (const f of pr.files) {
                if (!fileToAllPrs.has(f.path)) fileToAllPrs.set(f.path, []);
                fileToAllPrs.get(f.path)!.push(pr.number);
            }
        }
        const result = new Map<number, Array<{ file: string; others: number[] }>>();
        for (const pr of prs) {
            const entries: Array<{ file: string; others: number[] }> = [];
            for (const f of pr.files) {
                const others = (fileToAllPrs.get(f.path) ?? []).filter((n) => n !== pr.number);
                if (others.length > 0) entries.push({ file: f.path, others });
            }
            result.set(pr.number, entries);
        }
        return result;
    }, [prs]);

    // PRs the user has manually promoted from "conflicting" into the merge
    // check. Tracked locally — survives within this session but drops members
    // that disappear from prs (e.g., after merging + refreshing).
    const [promoted, setPromoted] = useState<Set<number>>(new Set());
    useEffect(() => {
        setPromoted((p) => {
            const filtered = new Set([...p].filter((n) => sortedPrs.some((pr) => pr.number === n)));
            return filtered.size === p.size ? p : filtered;
        });
    }, [sortedPrs]);
    function togglePromoted(prNumber: number, on: boolean) {
        setPromoted((p) => {
            const next = new Set(p);
            if (on) next.add(prNumber); else next.delete(prNumber);
            return next;
        });
    }

    const readyToCheck = useMemo(
        () => [...greens, ...nonGreens.filter((pr) => promoted.has(pr.number))],
        [greens, nonGreens, promoted],
    );

    const [response, setResponse] = useState<CheckConflictsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [merging, setMerging] = useState<number | null>(null);
    const [lastMerge, setLastMerge] = useState<LastMerge>(null);
    // Per-PR "skip branch delete" set. Default is delete; users opt out per PR.
    const [skipBranchDelete, setSkipBranchDelete] = useState<Set<number>>(new Set());
    function toggleSkipBranchDelete(prNumber: number, skip: boolean) {
        setSkipBranchDelete((s) => {
            const next = new Set(s);
            if (skip) next.add(prNumber); else next.delete(prNumber);
            return next;
        });
    }

    const results = response?.results ?? null;

    const [localPairwise, setLocalPairwise] = useState<LocalPairwiseState>({ phase: 'idle' });
    const pairwise: PairwisePrConflicts | null = localPairwise.phase === 'ready' ? localPairwise.pairwise : null;

    useEffect(() => {
        if (readyToCheck.length === 0) {
            setResponse(null);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            setResponse(null);
            try {
                const data = await apiCheckConflicts(owner, repo, readyToCheck.map((pr) => pr.number));
                if (!cancelled) setResponse(data);
            } catch (e) {
                if (!cancelled) setError((e as Error).message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prs, owner, repo, promoted]);

    // Browser-side pairwise — runs after the server response settles.
    // Fetches refs/pull/<N>/head for each candidate then runs mergeFile per
    // shared file. Requires readwrite (fetch writes pack files + refs).
    // Query-only — can't requestPermission from useEffect (SecurityError —
    // browsers require user gesture). User grants via the header badge.
    useEffect(() => {
        if (readyToCheck.length === 0) { setLocalPairwise({ phase: 'idle' }); return; }
        if (!folderHandle) { setLocalPairwise({ phase: 'no-folder' }); return; }
        let cancelled = false;
        (async () => {
            const level = await queryFolderPermission(folderHandle);
            if (cancelled) return;
            if (level !== 'readwrite') { setLocalPairwise({ phase: 'needs-readwrite' }); return; }
            const nums = readyToCheck.map((pr) => pr.number);
            setLocalPairwise({ phase: 'fetching', total: nums.length });
            try {
                const fetchResult = await fetchPrRefs(folderHandle, owner, repo, nums);
                if (cancelled) return;
                setLocalPairwise({ phase: 'computing' });
                const pairwise = await computeBrowserPairwise(folderHandle, readyToCheck);
                if (cancelled) return;
                setLocalPairwise({ phase: 'ready', pairwise, failedFetches: fetchResult.failed.map((f) => f.number) });
            } catch (e) {
                if (!cancelled) setLocalPairwise({ phase: 'error', message: (e as Error).message });
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prs, owner, repo, promoted, folderHandle]);

    const lookups = useMemo(() => {
        if (!results) return null;
        const m = new Map<number, { conflicts: Set<string>; touched: Set<string> }>();
        for (const [num, r] of Object.entries(results)) {
            m.set(Number(num), {
                conflicts: new Set(r.ok ? r.conflicts : []),
                touched: new Set(r.ok ? r.touchedByMaster : []),
            });
        }
        return m;
    }, [results]);

    const masterTouchByFile = useMemo(() => {
        if (!results) return null;
        const m = new Map<string, MasterTouch>();
        for (const r of Object.values(results)) {
            if (!r.ok) continue;
            for (const [path, info] of Object.entries(r.masterLastTouched)) {
                m.set(path, info);
            }
        }
        return m;
    }, [results]);

    const earliestPrUpdateByFile = useMemo(() => {
        const m = new Map<string, number>();
        for (const pr of readyToCheck) {
            const t = new Date(pr.updatedAt).getTime();
            for (const f of pr.files) {
                const cur = m.get(f.path);
                if (cur === undefined || t < cur) m.set(f.path, t);
            }
        }
        return m;
    }, [readyToCheck]);

    async function handleMerge(prNumber: number) {
        const deleteBranch = !skipBranchDelete.has(prNumber);
        const confirmMsg = `Squash-merge PR #${prNumber} on ${owner}/${repo}${deleteBranch ? ' (and delete the branch)' : ''}?`;
        if (!window.confirm(confirmMsg)) return;
        setMerging(prNumber);
        setLastMerge(null);
        try {
            const data: MergePrResult = await apiMergePr(owner, repo, prNumber, 'squash', deleteBranch);
            if (!data.ok) {
                if ('preflight' in data) {
                    setLastMerge({
                        ok: false,
                        prNumber,
                        message: data.preflight === 'wrong-branch'
                            ? `Server reports it's not on the default branch (${data.defaultBranch}).`
                            : `Working tree on ${data.defaultBranch} is dirty.`,
                    });
                    return;
                }
                setLastMerge({ ok: false, prNumber, message: data.error });
                return;
            }
            setLastMerge({ ok: true, prNumber, steps: data.steps, branchDeleteError: data.branchDeleteError });
            onMerged?.();
        } catch (e) {
            setLastMerge({ ok: false, prNumber, message: (e as Error).message });
        } finally {
            setMerging(null);
        }
    }

    if (greens.length === 0 && nonGreens.length === 0) return null;

    // Combine two severity sources into one cellState:
    //   master-vs-PR (existing): GitHub mergeable bit + master-touched files
    //   PR-vs-PR (new): pairwise line-level overlap between green PRs
    // Conflict wins over warning; either side can trigger either tier.
    const cellState: ((pr: PR, filePath: string) => CellState) | undefined = lookups
        ? (pr, filePath) => {
            const l = lookups.get(pr.number);
            const masterConflict = l?.conflicts.has(filePath);
            const masterWarn = l?.touched.has(filePath);
            const pairwiseSev = pairwise?.fileSeverity[filePath];
            if (masterConflict || pairwiseSev === 'conflict') return 'conflict';
            if (masterWarn || pairwiseSev === 'warning') return 'warning';
            return undefined;
        }
        : undefined;

    const renderFileExtra: ((filePath: string) => ReactNode) | undefined = masterTouchByFile
        ? (filePath: string) => {
            const info = masterTouchByFile.get(filePath);
            if (!info) return null;
            const masterMs = new Date(info.date).getTime();
            const earliestPr = earliestPrUpdateByFile.get(filePath);
            const stale = earliestPr !== undefined && masterMs > earliestPr;
            const tooltip = `Master last touched ${new Date(info.date).toLocaleString()}\n${info.sha}\n${info.subject}${stale ? '\n\n⚠ More recent than the earliest PR touching this file — review.' : ''}`;
            return (
                <div className={`${styles.masterChip} ${stale ? styles.chipStale : ''}`} title={tooltip}>
                    master · {formatRelativeShort(info.date)} · <code>{info.sha.slice(0, 7)}</code>
                </div>
            );
        }
        : undefined;

    const errors = results
        ? Object.entries(results).filter((entry): entry is [string, { ok: false; error: string }] => !entry[1].ok)
        : [];
    const allClean = results && errors.length === 0
        && Object.values(results).every((r) => r.ok && r.clean);

    const readyToMerge = results
        ? readyToCheck.filter((pr) => {
            const r = results[pr.number];
            return r?.ok && r.clean;
        })
        : [];

    return (
        <div className={styles.section}>
            <h2>Master Conflict Check</h2>
            <p className={styles.intro}>
                Files each candidate PR touches. <span className={styles.legendBad}>Red ✗</span> = real merge conflict with master. <span className={styles.legendWarn}>Yellow ⚠</span> = master also touched this file but it merges cleanly (review for semantic conflicts).
            </p>

            {loading && <p className={styles.status}>Checking {readyToCheck.length} candidate PR(s) against master…</p>}
            {error && <p className="picker-error">{error}</p>}
            <LocalPairwiseStatus state={localPairwise} />
            {pairwise && <PrDuplicatesBanner groups={pairwise.prGroups} />}
            {errors.length > 0 && (
                <ul className={styles.errors}>
                    {errors.map(([num, r]) => (
                        <li key={num}><strong>#{num}</strong>: {r.error}</li>
                    ))}
                </ul>
            )}
            {results && allClean && (
                <p className={styles.clean}>✓ All candidate PRs are clean against master.</p>
            )}

            {nonGreens.length > 0 && (
                <ConflictingPrsPanel
                    nonGreens={nonGreens}
                    promoted={promoted}
                    onToggle={togglePromoted}
                    conflictsByPr={conflictsByPr}
                />
            )}

            {readyToCheck.length > 0 && (
                <PrMatrix prs={readyToCheck} cellState={cellState} renderFileExtra={renderFileExtra} />
            )}

            {readyToMerge.length > 0 && (
                <div className={styles.mergeReady}>
                    <h3>Ready to merge ({readyToMerge.length})</h3>
                    <p className={styles.mergeIntro}>
                        One-click squash-merge via the GitHub API. Branch protection / required checks still apply.
                    </p>
                    {lastMerge && (
                        <div className={lastMerge.ok ? styles.mergeSuccess : styles.mergeWarn}>
                            <strong>
                                {lastMerge.ok ? `✓ Merged #${lastMerge.prNumber}` : `⚠ Couldn't merge #${lastMerge.prNumber}`}
                            </strong>
                            {lastMerge.ok ? (
                                <>
                                    <ol>{lastMerge.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                                    {lastMerge.branchDeleteError && (
                                        <p style={{ marginTop: 4, color: '#9a6700', fontSize: 12 }}>
                                            ⚠ Branch wasn't deleted: {lastMerge.branchDeleteError}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p>{lastMerge.message}</p>
                            )}
                        </div>
                    )}
                    <ul className={styles.mergeList}>
                        {readyToMerge.map((pr) => (
                            <li key={pr.number}>
                                <span><strong>#{pr.number}</strong> — {pr.title} <span className="muted">({pr.author.login} · {pr.headRefName})</span></span>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#57606a', whiteSpace: 'nowrap' }}>
                                    <input
                                        type="checkbox"
                                        checked={!skipBranchDelete.has(pr.number)}
                                        onChange={(e) => toggleSkipBranchDelete(pr.number, !e.target.checked)}
                                        disabled={merging !== null}
                                    />
                                    Delete branch
                                </label>
                                <button
                                    className={`primary ${styles.mergeBtn}`}
                                    onClick={() => handleMerge(pr.number)}
                                    disabled={merging !== null}
                                >
                                    {merging === pr.number ? 'Merging…' : 'Squash & merge'}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
