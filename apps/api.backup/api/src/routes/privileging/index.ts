/**
 * Privileging Routes Index
 * Exports all privileging-related route handlers
 */

import { Router } from 'express';
import { privilegeSetsRouter } from '../org/privilegeSets/create';
import { privilegeRequestRouter } from '../privileges/request';
import { privilegeReviewRouter } from './review';
import { tempPrivilegeRequestRouter } from '../privileges/tempRequest';
import { privilegeRenewalRouter } from '../privileges/renew';

const router = Router();

// Mount subroutes
router.use('/privilegeSets', privilegeSetsRouter);
router.use('/', privilegeRequestRouter);
router.use('/', privilegeReviewRouter);
router.use('/', tempPrivilegeRequestRouter); // B135A-PRIV-004: Temporary privileges
router.use('/', privilegeRenewalRouter); // B135A-PRIV-008: Renewal management

export { router as privilegingRouter };

