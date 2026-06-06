import type { LocalPairwiseState } from '../types.js';

interface Props {
    loading: boolean;          // server-side master check in flight
    candidateCount: number;
    localPairwise: LocalPairwiseState;
}

// Live progress of the PR conflict checks, shown in the shared top-level modal.
export default function PrProgressView({ loading, candidateCount, localPairwise }: Props) {
    return (
        <div style={{ fontSize: 13, color: '#57606a' }}>
            {loading && <p style={{ margin: '0 0 6px' }}>Checking {candidateCount} candidate PR(s) against master…</p>}
            {localPairwise.phase === 'fetching' && <p style={{ margin: 0 }}>Fetching {localPairwise.total} PR ref(s) via proxy…</p>}
            {localPairwise.phase === 'computing' && <p style={{ margin: 0 }}>Running 3-way merge per shared file…</p>}
        </div>
    );
}
