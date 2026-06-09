import type { LocalPairwiseState } from '../types.js';

// Renders the current phase of the browser-side pairwise computation as a small
// status line (idle/ready render nothing, except a warning when some PR refs
// couldn't be fetched).
export default function LocalPairwiseStatus({ state }: { state: LocalPairwiseState }) {
    if (state.phase === 'idle' || state.phase === 'ready') {
        if (state.phase === 'ready' && state.failedFetches.length > 0) {
            return (
                <p style={{ margin: '6px 0', fontSize: 12, color: '#9a6700' }}>
                    ⚠ Couldn't fetch PR refs for: {state.failedFetches.map((prNumber) => `#${prNumber}`).join(', ')} —
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
    if (state.phase === 'fetching') {
        return <p style={{ margin: '6px 0', fontSize: 12, color: '#57606a' }}>Fetching {state.total} PR ref(s) via proxy…</p>;
    }
    if (state.phase === 'computing') {
        return <p style={{ margin: '6px 0', fontSize: 12, color: '#57606a' }}>Running 3-way merge per shared file…</p>;
    }
    return <p style={{ margin: '6px 0', fontSize: 12, color: '#cf222e' }}>Pairwise check failed: {state.message}</p>;
}
