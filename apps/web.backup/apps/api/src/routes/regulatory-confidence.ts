/**
 * Batch 433 — Regulatory Confidence Map v8
 */

import { Router, type Request, type Response } from 'express';
import { generateRegulatoryConfidence, exportConfidencePack } from '../services/regulatory-confidence';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { clinicianId, signals } = req.body;
    if (!clinicianId || !signals) {
      return res.status(400).json({ error: 'clinicianId and signals required' });
    }
    const result = await generateRegulatoryConfidence(clinicianId, signals);
    return res.json(result);
  } catch (error) {
    console.error('[regulatory-confidence] error', error);
    return res.status(500).json({ error: 'regulatory_confidence_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.regulatoryConfidenceMap.findUnique({ where: { clinicianId } });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.confidence);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const dossier = await exportConfidencePack(clinicianId);
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;








