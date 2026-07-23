import { useContext } from 'react';
import { Button } from '@mui/material';
import Modal from '../ProgressModal/Modal.js';
import { AnalysisContext } from '../AnalysisContext.js';
import styles from './RefreshStatusModal.module.css';

type StepState = 'pending' | 'running' | 'ok' | 'error';

interface Step {
    label: string;
    state: StepState;
    detail: string;
}

const ICON: Record<StepState, string> = { pending: '○', running: '⏳', ok: '✓', error: '✗' };

// Blocking, non-escapable modal that reports a user-initiated refresh/merge:
// what's happening now, and — once the network work settles — a clear per-step
// result the user dismisses with OK. Auto/initial loads don't open it.
export default function RefreshStatusModal() {
    const {
        refreshModalOpen, refreshModalSettled, closeRefreshModal,
        prsLoading, prLoadStatus, contentError, branchesAnalysis,
    } = useContext(AnalysisContext);

    if (!refreshModalOpen) return null;

    const { busy, readProgress, fetching, refreshing, error: readError, lastFetch } = branchesAnalysis;

    const prStep: Step = prsLoading
        ? { label: 'Pull requests', state: 'running', detail: 'Loading open PRs…' }
        : contentError
            ? { label: 'Pull requests', state: 'error', detail: contentError }
            : { label: 'Pull requests', state: 'ok', detail: prLoadStatus || 'Loaded.' };

    const readStep: Step = busy
        ? { label: 'Local repository', state: 'running', detail: readProgress && readProgress.total > 0 ? `Reading branches… ${readProgress.done}/${readProgress.total}` : 'Reading branches…' }
        : readError
            ? { label: 'Local repository', state: 'error', detail: readError }
            : { label: 'Local repository', state: 'ok', detail: 'Branches read.' };

    const fetchStep: Step = fetching
        ? { label: 'Origin fetch', state: 'running', detail: 'Fetching + pruning from origin…' }
        : lastFetch == null
            // No result yet: still waiting on the read phase if the cycle is running,
            // otherwise the fetch genuinely didn't run (no remote).
            ? refreshing
                ? { label: 'Origin fetch', state: 'pending', detail: 'Waiting for the local read to finish…' }
                : { label: 'Origin fetch', state: 'pending', detail: 'Skipped (no remote configured).' }
            : lastFetch.ok
                ? { label: 'Origin fetch', state: 'ok', detail: `Fetched — pruned ${lastFetch.prunedRefs} stale ref(s).` }
                : { label: 'Origin fetch', state: 'error', detail: `Fetch failed: ${lastFetch.error}` };

    const steps = [prStep, readStep, fetchStep];
    const anyError = steps.some((step) => step.state === 'error');

    return (
        <Modal
            open
            onClose={() => { /* dismissed only via the OK button */ }}
            maxWidth="sm"
            disableBackdropClose
            actions={
                <Button onClick={closeRefreshModal} disabled={!refreshModalSettled} variant="contained">
                    OK
                </Button>
            }
        >
            <h3 className={styles.heading}>
                {refreshModalSettled ? (anyError ? 'Refresh finished with errors' : 'Refresh complete') : 'Refreshing repository…'}
            </h3>
            <ul className={styles.steps}>
                {steps.map((step) => (
                    <li key={step.label} className={styles[step.state]}>
                        <span className={styles.icon} aria-hidden>{ICON[step.state]}</span>
                        <span className={styles.label}>{step.label}:</span>
                        <span className={styles.detail}>{step.detail}</span>
                    </li>
                ))}
            </ul>
            {!refreshModalSettled && <p className={styles.wait}>Please wait — this closes once the checks finish.</p>}
        </Modal>
    );
}
