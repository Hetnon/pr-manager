import { useEffect, useRef, useState, type FormEvent } from 'react';
import { parseRepo } from './useRepoSelection.js';

export interface RepoSelectorProps {
    initialValue: string;
    currentRepo: string | null;
    onSelect: (ownerRepo: string) => void;
    onCancel?: () => void;
    firstRun?: boolean;
}

export default function RepoSelector({ initialValue, currentRepo, onSelect, onCancel, firstRun }: RepoSelectorProps) {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    function submit(e: FormEvent) {
        e.preventDefault();
        const trimmed = value.trim();
        if (!parseRepo(trimmed)) {
            setError('Enter the repo as "owner/name" (e.g. anthropic/claude-code).');
            return;
        }
        onSelect(trimmed);
    }

    return (
        <div className="picker-overlay">
            <form className="picker" onSubmit={submit}>
                <h2>{firstRun ? 'Pick a repository' : 'Change repository'}</h2>
                <p className="picker-msg">
                    Enter a GitHub repository as <code>owner/name</code>.
                    {' '}You need at least read access; merging requires push access.
                </p>
                <div className="picker-row">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="anthropic/claude-code"
                        spellCheck={false}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                    />
                </div>
                <div className="picker-actions">
                    {!firstRun && currentRepo && onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
                    <button type="submit" className="primary">Save</button>
                </div>
                {error && <p className="picker-error">{error}</p>}
            </form>
        </div>
    );
}
