import { Router } from 'express';
import readJsonBody from '../../utils/readJsonBody.js';
import validateRepo from '../../utils/validateRepo.js';
import writeConfig from '../../utils/writeConfig.js';
import { CONFIG_FILE } from '../../paths.js';

const router = Router();

router.post('/config', async (req, res) => {
  const body = await readJsonBody<{ repoPath?: string }>(req);
  const result = await validateRepo(body.repoPath);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  writeConfig(CONFIG_FILE, { repoPath: result.repoPath });
  res.json({ repoPath: result.repoPath });
});

export default router;
