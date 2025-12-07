import { Router, type Request, type Response } from 'express';
import {
  getOrCreateComplianceHorizon,
  exportHorizonPack,
  anchorComplianceHorizonSnapshot,
} from '../services/compliance-horizon/index';

const router = Router();

router.get('/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const horizon = await getOrCreateComplianceHorizon(region);
    return res.json(horizon);
  } catch (error) {
    console.error('[compliance-horizon] failed', error);
    return res.status(500).json({
      error: 'horizon_fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:region/anchor', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    await anchorComplianceHorizonSnapshot(region);
    return res.json({ success: true, message: 'Compliance horizon anchored' });
  } catch (error) {
    console.error('[compliance-horizon] anchor failed', error);
    return res.status(500).json({
      error: 'horizon_anchor_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:region/export', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const exportData = await exportHorizonPack(region);
    return res.json(exportData);
  } catch (error) {
    console.error('[compliance-horizon] export failed', error);
    return res.status(500).json({
      error: 'horizon_export_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

