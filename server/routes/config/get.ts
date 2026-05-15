import { Router } from 'express';
import readConfig from '../../utils/readConfig.js';
import { CONFIG_FILE } from '../../paths.js';

const router = Router();

router.get('/config', (_req, res) => {
  const cfg = readConfig(CONFIG_FILE);
  res.json({ repoPath: cfg.repoPath || null });
});

export default router;
