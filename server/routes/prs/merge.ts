import { Router } from 'express';
import readConfig from '../../utils/readConfig.js';
import validateRepo from '../../utils/validateRepo.js';
import readJsonBody from '../../utils/readJsonBody.js';
import mergePr from '../../utils/mergePr.js';
import type { MergeStrategy } from '@shared/merge.js';
import { CONFIG_FILE } from '../../paths.js';

type MergeBody = { prNumber?: number | string; strategy?: MergeStrategy };

const router = Router();

router.post('/merge-pr', async (req, res) => {
  const cfg = readConfig(CONFIG_FILE);
  if (!cfg.repoPath) {
    res.status(400).json({ error: 'No repository configured.' });
    return;
  }
  const v = await validateRepo(cfg.repoPath);
  if (!v.ok) {
    res.status(400).json({ error: v.error });
    return;
  }
  const body = await readJsonBody<MergeBody>(req).catch((): MergeBody => ({}));
  if (!body.prNumber) {
    res.status(400).json({ error: 'prNumber required' });
    return;
  }
  const result = await mergePr(v.repoPath, body.prNumber, body.strategy);
  res.status(result.ok ? 200 : 500).json(result);
});

export default router;
