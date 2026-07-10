import { JSX } from 'react';
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
}

// The push / open-PR buttons for one branch row. Both labels share a min-width
// (see BranchList.module.css) so they render the same size.
export default function BranchActionsButtons({
    canPush, canOpenPr, disabled, disabledTitle, isPushing, isOpening, onPush, onOpenPr,
}: Readonly<BranchActionsButtonsProps>): JSX.Element {
    return (
        <div className={styles.colActionsCell}>
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
        </div>
    );
}
