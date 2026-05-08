import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RepoPicker from './picker/RepoPicker.jsx';
import usePicker from './picker/usePicker.js';
import { fetchSavedRepo } from './picker/api.js';
import PrMatrix from './prMatrix/PrMatrix.jsx';

function App() {
  const [currentRepo, setCurrentRepo] = useState(null);
  const [prs, setPrs] = useState(null);
  const [status, setStatus] = useState('');
  const [contentError, setContentError] = useState(null);
  const initializedRef = useRef(false);

  const picker = usePicker({
    currentRepo,
    onSaved: (newRepo) => {
      setCurrentRepo(newRepo);
      loadPRs();
    },
  });

  useEffect(() => {
    async function init() {
      const repoPath = await fetchSavedRepo();
      setCurrentRepo(repoPath);
      if (repoPath) {
        loadPRs();
      } else {
        picker.show({ firstRun: true, repoPath });
      }
      initializedRef.current = true;
    }
    init();
  }, []);

  async function loadPRs() {
    setStatus('Loading...');
    setPrs(null);
    setContentError(null);

    try {
      const res = await fetch('/api/prs');
      const data = await res.json();
      if (!res.ok || data.error) {
        if (data?.needsRepo) {
          setContentError(data.error);
          setStatus('');
          picker.show({ firstRun: !currentRepo, errorMsg: data.error });
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setPrs(data);
      setStatus(`Loaded ${data.length} open PR(s) at ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      setContentError(`Error: ${e.message}`);
      setStatus('');
    }
  }

  const hasRepo = Boolean(currentRepo);

  return (
    <>
      <header>
        <h1>PR File Overlap Matrix</h1>
        <div className="controls">
          {hasRepo && <span className="repo-display" title={currentRepo}>{currentRepo}</span>}
          {hasRepo && <button onClick={() => picker.show({ firstRun: false })}>Change repo</button>}
          {hasRepo && <button onClick={loadPRs}>↻ Refresh</button>}
          <span id="status">{status}</span>
        </div>
      </header>
      <main>
        {contentError && <p className="error">{contentError}</p>}
        {!contentError && prs === null && <p className="loading">{initializedRef.current ? 'Loading PRs...' : 'Loading...'}</p>}
        {!contentError && Array.isArray(prs) && <PrMatrix prs={prs} />}
      </main>
      {picker.isOpen && <RepoPicker {...picker.viewProps} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
