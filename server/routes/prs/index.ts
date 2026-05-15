import { Router } from 'express';
import list from './list.js';
import merge from './merge.js';
import conflicts from './conflicts.js';

const router = Router();
router.use(list);
router.use(merge);
router.use(conflicts);

export default router;
