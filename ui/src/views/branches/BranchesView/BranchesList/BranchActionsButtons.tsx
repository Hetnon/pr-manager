import { JSX, type ReactNode } from 'react';
import styles from './BranchList.module.css';

interface BranchActionsButtonsProps {
    canPush: boolean;
    canOpenPr: boolean;
    disabled: boolean;
    disabledTitle?: string;
    isPushing: boolean;
    isOpening: boolean;
    onPush: () => void;
    onOpenPr: () => void;
    trailing?: ReactNode;   // the delete / switch admin button for this row
    error?: string | null;  // a failed delete / switch, shown under the buttons
}

// The action buttons for one branch row: push / open-PR, plus the trailing admin
// button (delete or switch). Push labels share a min-width so they render the same
// size; the admin button is compact (see BranchList.module.css).
export default function BranchActionsButtons({
    canPush, canOpenPr, disabled, disabledTitle, isPushing, isOpening, onPush, onOpenPr, trailing, error,
}: Readonly<BranchActionsButtonsProps>): JSX.Element {
    return (
        <div className={styles.colActionsCell}>
            <div className={styles.actionsRow}>
                {canPush && (
                    <button type="button" onClick={onPush} disabled={disabled} title={disabledTitle}>
                        {isPushing ? 'Pushing…' : 'Push'}
                    </button>
                )}
                {canOpenPr && (
                    <button type="button" onClick={onOpenPr} disabled={disabled} title={disabledTitle}>
                        {isOpening ? 'Opening…' : 'Push & Open PR'}
                    </button>
                )}
                {trailing}
            </div>
            {error && <span className={`bad ${styles.actionError}`} title={error}>✗ {error}</span>}
        </div>
    );
}
