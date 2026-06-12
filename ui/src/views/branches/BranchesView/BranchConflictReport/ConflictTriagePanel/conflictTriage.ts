import type { LocalConflictReport } from '../checkLocalConflicts.js';

export type ConflictKind = 'textual-conflict' | 'clean-overlap' | 'additive' | 'cross-reference' | 'possible-dynamic';
export type Risk = 'low' | 'medium' | 'high';
export type ResolutionOption = 'keep-one' | 'merge' | 'deep-investigate' | 'ignore';

export interface TriageResult {
    file: string;
    branches: string[];
    kind: ConflictKind;
    risk: Risk;
    needsDeepReview: boolean;
    options: ResolutionOption[];
    reason: string;
    confidence: 'low' | 'medium' | 'high';
}

// The "conflict-triage" skill — the cheap first pass. It CLASSIFIES a conflict (risk +
// recommended options), never resolves it. The model is fed each side's hunks + intent +
// repo-wide cross-references for the changed symbols, and is biased to escalate: a wrong
// "safe" ships a silent break, so when unsure it flags deep review. This is the prompt the
// LLM producer uses; triageStatically below is the no-LLM first cut behind the same shape.
export const CONFLICT_TRIAGE_PROMPT = `You are triaging a merge conflict between branches that share a common base.

Rules:
- CLASSIFY, do not resolve. Never output merged code.
- Bias to escalate: if you're unsure whether the two changes can affect each other, set needsDeepReview=true and risk>="medium". A wrong "safe" ships a silent break — far worse than an extra review.
- A clean textual merge is NOT proof of safety — logic can change with no conflict markers (a signature change on one side, a caller on the other).
- Any cross-file reference to a symbol one side changed → kind="cross-reference", risk="high", escalate.
- Changes to string literals shaped like routes / events / config keys / DI tokens → kind="possible-dynamic", escalate (you can't see the consumer statically).
- Only pure, disjoint additions with no shared or cross-referenced symbols may be low risk.

Output strict JSON per file: { "file", "kind", "risk", "needsDeepReview", "options", "reason" (one terse line), "confidence" }.
options ⊆ ["keep-one","merge","deep-investigate","ignore"].`;

// No-LLM first cut: classifies the structural shape from the analysis we already have and
// escalates everything to deep review — static can't clear semantic risk (that's the LLM's
// job). Drop in the CONFLICT_TRIAGE_PROMPT producer to refine these verdicts.
export function triageStatically(report: LocalConflictReport): TriageResult[] {
    const results: TriageResult[] = [];
    for (const [file, detail] of Object.entries(report.fileDetail)) {
        if (detail.severity === 'safe' || detail.severity === 'identical') continue;
        const branches = detail.edits.map((edit) => edit.branch);
        if (detail.severity === 'conflict') {
            results.push({
                file, branches, kind: 'textual-conflict', risk: 'high', needsDeepReview: true,
                options: ['keep-one', 'merge', 'deep-investigate', 'ignore'],
                reason: `Overlapping edits across ${branches.length} branches collide on this file.`,
                confidence: 'high',
            });
        } else {
            results.push({
                file, branches, kind: 'clean-overlap', risk: 'medium', needsDeepReview: true,
                options: ['keep-one', 'merge', 'deep-investigate', 'ignore'],
                reason: `${branches.length} branches touch this file; it merges cleanly but the logic can still break silently.`,
                confidence: 'low',
            });
        }
    }
    const rank: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
    return results.sort((a, b) => rank[a.risk] - rank[b.risk] || a.file.localeCompare(b.file));
}
