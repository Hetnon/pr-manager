import { Router } from 'express';
import readConfig from '../../utils/readConfig.js';
import validateRepo from '../../utils/validateRepo.js';
import fetchPRs from '../../utils/fetchPRs.js';
import { CONFIG_FILE } from '../../paths.js';

const router = Router();

router.get('/prs', async (_req, res) => {
  const cfg = readConfig(CONFIG_FILE);
  if (!cfg.repoPath) {
    res.status(400).json({ error: 'No repository configured.', needsRepo: true });
    return;
  }
  const v = await validateRepo(cfg.repoPath);
  if (!v.ok) {
    res.status(400).json({ error: v.error, needsRepo: true });
    return;
  }
  try {
    const prs = await fetchPRs(v.repoPath);
    res.json(prs);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
