interface Props {
    onRetry: () => void;
}

// Shown when the session check fails for a technical reason (server down, network
// dropped) — a generic, retryable message rather than the raw error.
export default function SessionError({ onRetry }: Props) {
    return (
        <div className="error">
            <p>Couldn't reach the server to check your session — it may be down, or your connection dropped.</p>
            <button onClick={onRetry}>Try again</button>
        </div>
    );
}
