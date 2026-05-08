export async function fetchSavedRepo() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    return cfg.repoPath || null;
  } catch {
    return null;
  }
}

export async function pickFolderViaDialog(initialDir) {
  const res = await fetch('/api/pick-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialDir }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.path || null;
}

export async function saveRepo(repoPath) {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to save.');
  return data.repoPath;
}
