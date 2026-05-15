import { Router } from 'express';
import createLiveReload from '../utils/liveReload.js';
import { PUBLIC_DIR } from '../paths.js';

const liveReload = createLiveReload({ watchPath: PUBLIC_DIR, watchFile: 'app.js' });

const router = Router();
router.get('/_reload', liveReload.handler);

export default router;
