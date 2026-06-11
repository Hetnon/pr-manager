import { useState } from 'react';
import type { TriageResult, ResolutionOption } from './conflictTriage.js';
import styles from './ConflictTriagePanel.module.css';

const OPTION_LABEL: Record<ResolutionOption, string> = {
    'keep-one': 'Keep one (drop the rest)',
    'merge': 'Merge',
    'deep-investigate': 'Deep investigate',
    'ignore': 'Ignore',
};
const riskClass: Record<TriageResult['risk'], string> = { high: styles.high, medium: styles.medium, low: styles.low };

// The second gate: shows the cheap triage's verdict per remaining-conflict file and lets
// the user accept a recommendation or ignore the file. Decisions are local for now —
// applying them (drop to the view, hand "deep investigate" to the model) is the next layer.
export default function ConflictTriagePanel({ results }: Readonly<{ results: TriageResult[] }>) {
    const [decisions, setDecisions] = useState<Map<string, string>>(new Map());

    if (results.length === 0) {
        return <p className={styles.clear}>✓ No conflicts remain — every shared file is clean or collapsed.</p>;
    }

    const decide = (file: string, label: string) => setDecisions((prev) => new Map(prev).set(file, label));
    const undo = (file: string) => setDecisions((prev) => { const next = new Map(prev); next.delete(file); return next; });
    const pending = results.filter((result) => !decisions.has(result.file)).length;

    return (
        <div className={styles.card}>
            <h3 className={styles.title}>Conflict triage — {pending} of {results.length} undecided</h3>
            <p className={styles.intro}>
                Cheap first-pass classification of what remains after dedup. Accept a recommendation or ignore the file.
                Everything is flagged for review by default — a clean merge isn't proof it's safe.
            </p>
            <ul className={styles.list}>
                {results.map((result) => {
                    const decided = decisions.get(result.file);
                    return (
                        <li key={result.file} className={styles.row}>
                            <div className={styles.head}>
                                <span className={`${styles.risk} ${riskClass[result.risk]}`}>{result.risk}</span>
                                <code className={styles.file}>{result.file}</code>
                                <span className={styles.branches}>{result.branches.join(' · ')}</span>
                            </div>
                            <p className={styles.reason}>{result.reason}</p>
                            {decided
                                ? <p className={styles.decided}>→ {decided} <button type="button" className={styles.undo} onClick={() => undo(result.file)}>undo</button></p>
                                : (
                                    <div className={styles.actions}>
                                        {result.options.map((option) => (
                                            <button key={option} type="button" className={styles.action} onClick={() => decide(result.file, OPTION_LABEL[option])}>
                                                {OPTION_LABEL[option]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
