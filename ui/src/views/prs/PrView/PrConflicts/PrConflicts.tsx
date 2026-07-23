import { useContext } from 'react';
import { AnalysisContext } from '../../../AnalysisContext.js';
import { PrConflictsProvider } from './PrConflictsProvider.js';
import PrConflictsBody from './PrConflictsBody.js';

interface Props {
    onMerged?: () => void;
}

// Gate: nothing to show until there's at least one open PR. The analysis itself runs
// app-level in AnalysisProvider; the provider below bundles it with the merge/close actions.
export default function PrConflicts({ onMerged }: Readonly<Props>) {
    const { greens, nonGreens } = useContext(AnalysisContext).prsAnalysis;
    if (greens.length === 0 && nonGreens.length === 0) return null;
    return (
        <PrConflictsProvider onMerged={onMerged}>
            <PrConflictsBody />
        </PrConflictsProvider>
    );
}
