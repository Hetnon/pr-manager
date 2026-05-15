import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import type { CheckMasterConflictResult, MasterTouch } from '@shared/conflicts.js';
import type { MergePrResult } from '@shared/merge.js';
import { buildMatrix } from '../lib/matrix.js';
import { checkMasterConflicts as apiCheckConflicts, mergePr as apiMergePr } from '../api/prs.js';
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
    onMerged?: () => void;
}

type LastMerge =
    | null
    | { ok: true; prNumber: number; steps: string[] }
    | { ok: false; prNumber: number; message: string };

export default function MasterCheck({ prs, owner, repo, onMerged }: Props) {
    const { sortedPrs, prSafe } = useMemo(() => buildMatrix(prs), [prs]);
    const greens = sortedPrs.filter((pr) => prSafe.get(pr.number));
    const [results, setResults] = useState<Record<string, CheckMasterConflictResult> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [merging, setMerging] = useState<number | null>(null);
    const [lastMerge, setLastMerge] = useState<LastMerge>(null);

    useEffect(() => {
        if (greens.length === 0) {
            setResults(null);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            setResults(null);
            try {
                const data = await apiCheckConflicts(owner, repo, greens.map((pr) => pr.number));
                if (!cancelled) setResults(data);
            } catch (e) {
                if (!cancelled) setError((e as Error).message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prs, owner, repo]);

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
        for (const pr of greens) {
            const t = new Date(pr.updatedAt).getTime();
            for (const f of pr.files) {
                const cur = m.get(f.path);
                if (cur === undefined || t < cur) m.set(f.path, t);
            }
        }
        return m;
    }, [greens]);

    async function handleMerge(prNumber: number) {
        if (!window.confirm(`Squash-merge PR #${prNumber} on ${owner}/${repo}?`)) return;
        setMerging(prNumber);
        setLastMerge(null);
        try {
            const data: MergePrResult = await apiMergePr(owner, repo, prNumber, 'squash');
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
            setLastMerge({ ok: true, prNumber, steps: data.steps });
            onMerged?.();
        } catch (e) {
            setLastMerge({ ok: false, prNumber, message: (e as Error).message });
        } finally {
            setMerging(null);
        }
    }

    if (greens.length === 0) return null;

    const cellState: ((pr: PR, filePath: string) => CellState) | undefined = lookups
        ? (pr, filePath) => {
            const l = lookups.get(pr.number);
            if (!l) return undefined;
            if (l.conflicts.has(filePath)) return 'conflict';
            if (l.touched.has(filePath)) return 'warning';
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
        ? greens.filter((pr) => {
            const r = results[pr.number];
            return r?.ok && r.clean;
        })
        : [];

    return (
        <div className={styles.section}>
            <h2>Master Conflict Check</h2>
            <p className={styles.intro}>
                Files each green PR touches. <span className={styles.legendBad}>Red ✗</span> = real merge conflict with master. <span className={styles.legendWarn}>Yellow ⚠</span> = master also touched this file but it merges cleanly (review for semantic conflicts).
            </p>

            {loading && <p className={styles.status}>Checking {greens.length} green PR(s) against master…</p>}
            {error && <p className="picker-error">{error}</p>}
            {errors.length > 0 && (
                <ul className={styles.errors}>
                    {errors.map(([num, r]) => (
                        <li key={num}><strong>#{num}</strong>: {r.error}</li>
                    ))}
                </ul>
            )}
            {results && allClean && (
                <p className={styles.clean}>✓ All green PRs are clean against master.</p>
            )}

            <PrMatrix prs={greens} cellState={cellState} renderFileExtra={renderFileExtra} />

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
                                <ol>{lastMerge.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                            ) : (
                                <p>{lastMerge.message}</p>
                            )}
                        </div>
                    )}
                    <ul className={styles.mergeList}>
                        {readyToMerge.map((pr) => (
                            <li key={pr.number}>
                                <span><strong>#{pr.number}</strong> — {pr.title} <span className="muted">({pr.author.login} · {pr.headRefName})</span></span>
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
