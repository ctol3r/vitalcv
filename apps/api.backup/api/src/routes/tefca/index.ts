/**
 * B136A: TEFCA Routes Index
 * Mounts all TEFCA-related routes
 */

import { Router } from 'express';
import { tefcaConfigRouter } from './config';
import { tefcaQueryRouter } from './query';

const router = Router();

// Mount subroutes
router.use('/', tefcaConfigRouter);
router.use('/', tefcaQueryRouter);

export { router as tefcaRouter };

