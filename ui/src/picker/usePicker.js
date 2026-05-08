import { useState } from 'react';
import { pickFolderViaDialog, saveRepo } from './api.js';

export default function usePicker({ currentRepo, onSaved }) {
  const [state, setState] = useState({ open: false, firstRun: false, errorMsg: null });
  const [repoInput, setRepoInput] = useState('');
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function show({ firstRun = false, errorMsg = null, repoPath = currentRepo } = {}) {
    setRepoInput(repoPath || '');
    setState({ open: true, firstRun, errorMsg });
  }

  function close() {
    setState(prev => ({ ...prev, open: false, errorMsg: null }));
  }

  async function browse() {
    setState(prev => ({ ...prev, errorMsg: null }));
    setIsBrowsing(true);
    try {
      const picked = await pickFolderViaDialog(repoInput || currentRepo || '');
      if (picked) setRepoInput(picked);
    } catch (e) {
      setState(prev => ({ ...prev, errorMsg: e.message }));
    } finally {
      setIsBrowsing(false);
    }
  }

  async function save() {
    const repoPath = repoInput.trim();
    if (!repoPath) {
      setState(prev => ({ ...prev, errorMsg: 'Enter or browse to a repository folder.' }));
      return;
    }
    setIsSaving(true);
    setState(prev => ({ ...prev, errorMsg: null }));
    try {
      const newRepoPath = await saveRepo(repoPath);
      close();
      onSaved?.(newRepoPath);
    } catch (e) {
      setState(prev => ({ ...prev, errorMsg: e.message }));
    } finally {
      setIsSaving(false);
    }
  }

  return {
    isOpen: state.open,
    show,
    close,
    viewProps: {
      firstRun: state.firstRun,
      errorMsg: state.errorMsg,
      repoInput,
      currentRepo,
      isBrowsing,
      isSaving,
      onInputChange: setRepoInput,
      onBrowse: browse,
      onSave: save,
      onCancel: close,
    },
  };
}
