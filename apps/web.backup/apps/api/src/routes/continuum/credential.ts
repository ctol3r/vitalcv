import { Router, type Request, type Response } from 'express';
import {
  getCredentialContinuum,
  exportContinuumPack,
  anchorContinuumSnapshot,
} from '@/services/continuum/credentialContinuum';

const router = Router();

/**
 * Task 360.4 — Continuum UI endpoint
 */
router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const continuum = await getCredentialContinuum(clinicianId);
    return res.json(continuum);
  } catch (error) {
    console.error('[CredentialContinuum] Get failed', error);
    return res.status(500).json({ error: 'get_failed' });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const pack = await exportContinuumPack(clinicianId);
    return res.json(pack);
  } catch (error) {
    console.error('[CredentialContinuum] Export failed', error);
    return res.status(500).json({ error: 'export_failed' });
  }
});

router.post('/:clinicianId/anchor', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const txHash = await anchorContinuumSnapshot(clinicianId);
    return res.json({ txHash, anchoredAt: new Date().toISOString() });
  } catch (error) {
    console.error('[CredentialContinuum] Anchor failed', error);
    return res.status(500).json({ error: 'anchor_failed' });
  }
});

export default router;

