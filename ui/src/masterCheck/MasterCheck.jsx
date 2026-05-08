import { useEffect, useMemo, useState } from 'react';
import { buildMatrix } from '../lib/matrix.js';
import PrMatrix from '../prMatrix/PrMatrix.jsx';
import styles from './MasterCheck.module.css';

function formatRelativeShort(iso) {
  if (!iso) return '';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

export default function MasterCheck({ prs, onMerged }) {
  const { sortedPrs, prSafe } = useMemo(() => buildMatrix(prs), [prs]);
  const greens = sortedPrs.filter(pr => prSafe.get(pr.number));
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [merging, setMerging] = useState(null);   // pr# currently being merged
  const [lastMerge, setLastMerge] = useState(null); // { ok, prNumber, steps?, message? }

  // Auto-run after the peer matrix loads, and re-run when prs change.
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
        const res = await fetch('/api/master-conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prNumbers: greens.map(pr => pr.number) }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) setResults(data.results);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [prs]);

  // pr# -> { conflicts: Set, touched: Set } for fast cell-level lookup
  const lookups = useMemo(() => {
    if (!results) return null;
    const m = new Map();
    for (const [num, r] of Object.entries(results)) {
      m.set(Number(num), {
        conflicts: new Set(r.ok ? r.conflicts || [] : []),
        touched: new Set(r.ok ? r.touchedByMaster || [] : []),
      });
    }
    return m;
  }, [results]);

  // file path -> { sha, date, subject } from master's git log.
  // Same file across multiple PRs has the same answer (master is shared),
  // so we just merge — last write wins, all writes are equivalent.
  const masterTouchByFile = useMemo(() => {
    if (!results) return null;
    const m = new Map();
    for (const r of Object.values(results)) {
      if (!r.ok || !r.masterLastTouched) continue;
      for (const [path, info] of Object.entries(r.masterLastTouched)) {
        m.set(path, info);
      }
    }
    return m;
  }, [results]);

  // Earliest PR updatedAt that touches each file — used to flag chips when
  // master's last edit is more recent than the PR's last activity.
  const earliestPrUpdateByFile = useMemo(() => {
    const m = new Map();
    for (const pr of greens) {
      const t = new Date(pr.updatedAt).getTime();
      for (const f of pr.files) {
        const cur = m.get(f.path);
        if (cur === undefined || t < cur) m.set(f.path, t);
      }
    }
    return m;
  }, [greens]);

  async function handleMerge(prNumber) {
    if (!window.confirm(`Squash-merge PR #${prNumber} and delete its branch on origin?`)) return;
    setMerging(prNumber);
    setLastMerge(null);
    try {
      const res = await fetch('/api/merge-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber, strategy: 'squash' }),
      });
      const data = await res.json();

      if (data.preflight === 'wrong-branch') {
        setLastMerge({
          ok: false, prNumber,
          message: `Local repo is on branch "${data.currentBranch}", not "${data.defaultBranch}". Switch to ${data.defaultBranch} first, then try again.`,
        });
        return;
      }
      if (data.preflight === 'dirty-tree') {
        setLastMerge({
          ok: false, prNumber,
          message: `Your working tree on ${data.defaultBranch} has uncommitted changes. Commit or stash them, then try again.`,
        });
        return;
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setLastMerge({ ok: true, prNumber, steps: data.steps });
      onMerged?.();
    } catch (e) {
      setLastMerge({ ok: false, prNumber, message: e.message });
    } finally {
      setMerging(null);
    }
  }

  if (greens.length === 0) return null;

  // 'conflict' (red ✗) > 'warning' (yellow ⚠) > undefined (green ●)
  const cellState = lookups
    ? (pr, filePath) => {
        const l = lookups.get(pr.number);
        if (!l) return undefined;
        if (l.conflicts.has(filePath)) return 'conflict';
        if (l.touched.has(filePath)) return 'warning';
        return undefined;
      }
    : undefined;

  const renderFileExtra = masterTouchByFile
    ? (filePath) => {
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

  const errors = results ? Object.entries(results).filter(([, r]) => !r.ok) : [];
  const allClean = results && errors.length === 0
    && Object.values(results).every(r => r.clean);

  // PRs that are both peer-safe (greens) AND master-clean → mergeable in one click
  const readyToMerge = results
    ? greens.filter(pr => results[pr.number]?.ok && results[pr.number].clean)
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
            One-click squash-merge via <code>gh pr merge</code> + <code>git fetch origin --prune</code>. Branch protection / required checks still apply.
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
            {readyToMerge.map(pr => (
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
