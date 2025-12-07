/**
 * B136A: EHR Routes Index
 * Mounts all EHR-related routes
 */

import { Router } from 'express';
import { ehrConfigRouter } from './config';
import { ehrQueryRouter } from './query';

const router = Router();

// Mount subroutes
router.use('/', ehrConfigRouter);
router.use('/', ehrQueryRouter);

export { router as ehrRouter };

