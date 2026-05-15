import { Router } from 'express';
import readJsonBody from '../utils/readJsonBody.js';
import pickFolder from '../utils/pickFolder.js';

type PickFolderBody = { initialDir?: string };

const router = Router();

router.post('/pick-folder', async (req, res) => {
  const body = await readJsonBody<PickFolderBody>(req).catch((): PickFolderBody => ({}));
  try {
    const picked = await pickFolder(body.initialDir);
    res.json({ path: picked });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
