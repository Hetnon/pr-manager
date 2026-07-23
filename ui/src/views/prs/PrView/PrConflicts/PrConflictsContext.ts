import { createContext, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import type { useClosePr } from '../../../useClosePr.js';
import type { usePrActions } from './usePrActions.js';
import type { usePrAnalysis } from '../../usePrAnalysis/usePrAnalysis.js';
import type { CellState } from './PrMatrix/prMatrixModel.js';

type PrsAnalysis = ReturnType<typeof usePrAnalysis>;

// prsAnalysis (merged bag) + the merge/close actions + the values derived for the matrix,
// bundled so every child of the conflict panel reads one context instead of a prop spread.
export type PrConflictsContextValue =
    PrsAnalysis
    & ReturnType<typeof usePrActions>
    & ReturnType<typeof useClosePr>
    & {
        cellState?: (pr: PR, filePath: string) => CellState;
        renderFileExtra?: (filePath: string) => ReactNode;
        readyToMerge: PR[];
        errors: Array<[string, { ok: false; error: string }]>;
        allClean: boolean;
    };

export const PrConflictsContext = createContext<PrConflictsContextValue>(null as unknown as PrConflictsContextValue);
