import { Router, type Request, type Response } from 'express';
import {
  getOrCreateTalentResonance,
  exportResonanceBundle,
  anchorResonanceSnapshot,
} from '../services/resonance/index';

const router = Router();

router.get('/:clinicianId/:employerId', async (req: Request, res: Response) => {
  try {
    const { clinicianId, employerId } = req.params;
    const resonance = await getOrCreateTalentResonance(clinicianId, employerId);
    return res.json(resonance);
  } catch (error) {
    console.error('[talent-resonance] failed', error);
    return res.status(500).json({
      error: 'resonance_fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:clinicianId/:employerId/anchor', async (req: Request, res: Response) => {
  try {
    const { clinicianId, employerId } = req.params;
    await anchorResonanceSnapshot(clinicianId, employerId);
    return res.json({ success: true, message: 'Resonance snapshot anchored' });
  } catch (error) {
    console.error('[talent-resonance] anchor failed', error);
    return res.status(500).json({
      error: 'resonance_anchor_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:clinicianId/:employerId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId, employerId } = req.params;
    const exportData = await exportResonanceBundle(clinicianId, employerId);
    return res.json(exportData);
  } catch (error) {
    console.error('[talent-resonance] export failed', error);
    return res.status(500).json({
      error: 'resonance_export_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

