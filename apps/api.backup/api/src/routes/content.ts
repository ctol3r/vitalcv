/**
 * Content/KMS API Routes
 * B243A-KMS-008: ContentAPI
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createContentAPIRouter } from '../../services/kms/api/contentAPI.js';
import { loadUserSession } from '../middlewares/guards.js';

const prisma = new PrismaClient();
const contentRouter = createContentAPIRouter(prisma);

export const content = Router();
content.use(loadUserSession); // Load user session for all routes
content.use('/api/content', contentRouter);

