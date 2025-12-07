/**
 * Batch 431 — Employer Behavioral Forecast Tensor v8
 */

import { Router, type Request, type Response } from 'express';
import { generateBehaviorTensor, exportBehaviorTensorDossier } from '../services/employer-behavior-tensor';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { orgId, signals } = req.body;
    if (!orgId || !signals) {
      return res.status(400).json({ error: 'orgId and signals required' });
    }
    const result = await generateBehaviorTensor(orgId, signals);
    return res.json(result);
  } catch (error) {
    console.error('[behavior-tensor] error', error);
    return res.status(500).json({ error: 'behavior_tensor_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.employerBehaviorTensor.findUnique({ where: { orgId } });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.tensor);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:orgId/export', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const dossier = await exportBehaviorTensorDossier(orgId);
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;








