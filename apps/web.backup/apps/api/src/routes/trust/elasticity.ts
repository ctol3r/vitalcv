import { Router, type Request, type Response } from 'express';
import {
  getTrustElasticity,
  reinforceTrust,
  dampenTrust,
  exportTrustElasticityDossier,
  anchorElasticitySnapshot,
} from '@/services/trust/trustElasticity';

const router = Router();

/**
 * Task 358.4 — Trust elasticity UI endpoint
 */
router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const elasticity = await getTrustElasticity(clinicianId);
    return res.json(elasticity);
  } catch (error) {
    console.error('[TrustElasticity] Get failed', error);
    return res.status(500).json({ error: 'get_failed' });
  }
});

router.post('/:clinicianId/reinforce', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const { eventType, metadata } = req.body;
    const reinforcement = await reinforceTrust(clinicianId, eventType, metadata);
    return res.json({ reinforcement });
  } catch (error) {
    console.error('[TrustElasticity] Reinforce failed', error);
    return res.status(500).json({ error: 'reinforce_failed' });
  }
});

router.post('/:clinicianId/dampen', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const { eventType, severity } = req.body;
    const dampening = await dampenTrust(clinicianId, eventType, severity || 0.5);
    return res.json({ dampening });
  } catch (error) {
    console.error('[TrustElasticity] Dampen failed', error);
    return res.status(500).json({ error: 'dampen_failed' });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const dossier = await exportTrustElasticityDossier(clinicianId);
    return res.json(dossier);
  } catch (error) {
    console.error('[TrustElasticity] Export failed', error);
    return res.status(500).json({ error: 'export_failed' });
  }
});

router.post('/:clinicianId/anchor', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const txHash = await anchorElasticitySnapshot(clinicianId);
    return res.json({ txHash, anchoredAt: new Date().toISOString() });
  } catch (error) {
    console.error('[TrustElasticity] Anchor failed', error);
    return res.status(500).json({ error: 'anchor_failed' });
  }
});

export default router;

