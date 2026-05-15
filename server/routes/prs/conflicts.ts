import { Router } from 'express';
import readConfig from '../../utils/readConfig.js';
import validateRepo from '../../utils/validateRepo.js';
import readJsonBody from '../../utils/readJsonBody.js';
import checkMasterConflict from '../../utils/checkMasterConflict.js';
import type { CheckMasterConflictResult } from '@shared/conflicts.js';
import { CONFIG_FILE } from '../../paths.js';

type ConflictsBody = { prNumbers?: Array<number | string> };

const router = Router();

router.post('/master-conflicts', async (req, res) => {
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
  const body = await readJsonBody<ConflictsBody>(req).catch((): ConflictsBody => ({}));
  const prNumbers = Array.isArray(body.prNumbers) ? body.prNumbers : [];
  const results: Record<string, CheckMasterConflictResult> = {};
  for (const n of prNumbers) {
    results[String(n)] = await checkMasterConflict(v.repoPath, n);
  }
  res.json({ results });
});

export default router;
