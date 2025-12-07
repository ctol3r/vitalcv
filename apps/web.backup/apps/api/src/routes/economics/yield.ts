import { Router, type Request, type Response } from 'express';
import {
  getClinicianEconomicYield,
  alignEmployerValue,
  exportEconomicDossier,
  anchorEconomicYieldSnapshot,
} from '@/services/economics/clinicianEconomicYield';

const router = Router();

/**
 * Task 362.4 — Economic yield UI endpoint
 */
router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const yield_ = await getClinicianEconomicYield(clinicianId);
    return res.json(yield_);
  } catch (error) {
    console.error('[ClinicianEconomicYield] Get failed', error);
    return res.status(500).json({ error: 'get_failed' });
  }
});

router.get('/:clinicianId/align/:employerId', async (req: Request, res: Response) => {
  try {
    const { clinicianId, employerId } = req.params;
    const alignment = await alignEmployerValue(clinicianId, employerId);
    return res.json(alignment);
  } catch (error) {
    console.error('[ClinicianEconomicYield] Align failed', error);
    return res.status(500).json({ error: 'align_failed' });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const dossier = await exportEconomicDossier(clinicianId);
    return res.json(dossier);
  } catch (error) {
    console.error('[ClinicianEconomicYield] Export failed', error);
    return res.status(500).json({ error: 'export_failed' });
  }
});

router.post('/:clinicianId/anchor', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const txHash = await anchorEconomicYieldSnapshot(clinicianId);
    return res.json({ txHash, anchoredAt: new Date().toISOString() });
  } catch (error) {
    console.error('[ClinicianEconomicYield] Anchor failed', error);
    return res.status(500).json({ error: 'anchor_failed' });
  }
});

export default router;

