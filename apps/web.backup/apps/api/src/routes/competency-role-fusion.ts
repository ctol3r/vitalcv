/**
 * Batch 432 — Clinician Competency-Role Fusion Grid v7
 */

import { Router, type Request, type Response } from 'express';
import { generateFusionGrid, exportFusionDossier } from '../services/competency-role-fusion';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { clinicianId, competencies, duties, privileges } = req.body;
    if (!clinicianId || !competencies || !duties || !privileges) {
      return res.status(400).json({ error: 'clinicianId, competencies, duties, and privileges required' });
    }
    const result = await generateFusionGrid(clinicianId, competencies, duties, privileges);
    return res.json(result);
  } catch (error) {
    console.error('[competency-fusion] error', error);
    return res.status(500).json({ error: 'competency_fusion_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const record = await prisma.competencyRoleFusion.findUnique({ where: { clinicianId } });
    if (!record) return res.status(404).json({ error: 'not_found' });
    return res.json(record.fusion);
  } catch (error) {
    return res.status(500).json({ error: 'fetch_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const dossier = await exportFusionDossier(clinicianId);
    return res.json(dossier);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;








