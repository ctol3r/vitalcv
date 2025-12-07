/**
 * Batch 401 — Credential Harmonic Coherence Engine v7
 */

import { Router, type Request, type Response } from 'express';
import { generateCoherenceProfile, generateCoherenceAuditPack } from '../services/credential-coherence';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { clinicianId, fields } = req.body;
    if (!clinicianId || !fields) {
      return res.status(400).json({ error: 'clinicianId and fields required' });
    }
    const result = await generateCoherenceProfile(clinicianId, fields);
    return res.json(result);
  } catch (error) {
    console.error('[coherence] error', error);
    return res.status(500).json({ error: 'coherence_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.credentialCoherence.findUnique({ where: { clinicianId } });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.coherence);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const dossier = await generateCoherenceAuditPack(clinicianId);
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

