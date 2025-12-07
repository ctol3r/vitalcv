/**
 * Career Analytics API Routes
 * B233B-CAREER-009: CareerAnalyticsAPI
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createCareerAnalyticsRouter } from '../../services/career/api/careerAnalyticsAPI.js';

const prisma = new PrismaClient();
const careerRouter = createCareerAnalyticsRouter(prisma);

export const career = Router();
career.use('/api/career', careerRouter);

