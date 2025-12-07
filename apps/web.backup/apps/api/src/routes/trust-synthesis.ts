/**
 * Batch 400 — Global Provider Trust Synthesis Layer v8
 * API routes for trust synthesis
 */

import { Router, type Request, type Response } from 'express';
import { synthesizeTrustProfile, generateTrustDossier } from '../services/trust-synthesis';

const router = Router();

/**
 * POST /api/trust-synthesis
 * Synthesize trust profile for a clinician
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { clinicianId, chainTrust, issuerTrust, verifierTrust, employerTrust, regulatoryTrust, jurisdictions } =
      req.body;

    if (!clinicianId) {
      return res.status(400).json({ error: 'clinicianId required' });
    }

    const result = await synthesizeTrustProfile({
      clinicianId,
      chainTrust,
      issuerTrust,
      verifierTrust,
      employerTrust,
      regulatoryTrust,
      jurisdictions,
    });

    return res.json(result);
  } catch (error) {
    console.error('[trust-synthesis] error', error);
    return res.status(500).json({
      error: 'synthesis_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/trust-synthesis/:clinicianId
 * Get current trust synthesis for a clinician
 */
router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const record = await prisma.trustSynthesisLayer.findUnique({
      where: { clinicianId },
    });

    if (!record) {
      return res.status(404).json({ error: 'not_found', message: 'No trust synthesis found' });
    }

    return res.json(record.synthesis);
  } catch (error) {
    console.error('[trust-synthesis] error', error);
    return res.status(500).json({
      error: 'fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/trust-synthesis/:clinicianId/export
 * Generate executive trust dossier
 */
router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const dossier = await generateTrustDossier(clinicianId);

    return res.json(dossier);
  } catch (error) {
    console.error('[trust-synthesis] export error', error);
    return res.status(500).json({
      error: 'export_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

