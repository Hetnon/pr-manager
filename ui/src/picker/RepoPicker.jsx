import { useEffect, useRef } from 'react';

export default function RepoPicker({ firstRun, errorMsg, repoInput, currentRepo, isBrowsing, isSaving, onInputChange, onBrowse, onSave, onCancel }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="picker-overlay">
      <div className="picker">
        <h2>{firstRun ? 'Pick a repository' : 'Change repository'}</h2>
        <p className="picker-msg">
          {firstRun
            ? 'No repository is configured. Choose a folder that contains a git repository to start.'
            : 'Choose a different folder. It must contain a git repository.'}
        </p>
        <div className="picker-row">
          <input
            ref={inputRef}
            type="text"
            placeholder="C:\\path\\to\\your\\repo"
            spellCheck="false"
            value={repoInput}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSave();
            }}
          />
          <button onClick={onBrowse} disabled={isBrowsing}>{isBrowsing ? 'Opening…' : 'Browse…'}</button>
        </div>
        <div className="picker-actions">
          {!firstRun && currentRepo && <button onClick={onCancel}>Cancel</button>}
          <button className="primary" onClick={onSave} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</button>
        </div>
        {errorMsg && <p className="picker-error">{errorMsg}</p>}
      </div>
    </div>
  );
}
