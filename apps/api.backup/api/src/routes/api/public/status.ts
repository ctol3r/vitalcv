// B235B-API-018: API Status route handler

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { APIStatusHandler } from '../../services/api/public/statusHandler';

export function createAPIStatusRouter(prisma: PrismaClient): Router {
  const router = Router();
  const statusHandler = new APIStatusHandler(prisma);

  router.get('/status', async (req, res) => {
    await statusHandler.handleStatusRequest(req, res);
  });

  return router;
}

