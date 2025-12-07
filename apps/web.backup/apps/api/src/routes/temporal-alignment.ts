/**
 * Batch 430 — Credential Temporal Alignment Engine v7
 */

import { Router, type Request, type Response } from 'express';
import { generateTemporalAlignment, exportTemporalAlignmentDossier } from '../services/temporal-alignment';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({ error: 'credentialId required' });
    }
    const result = await generateTemporalAlignment(credentialId);
    return res.json(result);
  } catch (error) {
    console.error('[temporal-alignment] error', error);
    return res.status(500).json({ error: 'temporal_alignment_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:credentialId', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.temporalAlignment.findFirst({
      where: { credentialId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.alignment);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:credentialId/export', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const dossier = await exportTemporalAlignmentDossier(credentialId);
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;








