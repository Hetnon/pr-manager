import { Router } from 'express';
import get from './get.js';
import post from './post.js';

const router = Router();
router.use(get);
router.use(post);

export default router;
