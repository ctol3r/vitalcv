import { Router, type Request, type Response } from 'express';
import {
  getOrCreateReconciliationFabric,
  exportReconciliationAudit,
  anchorReconciliationSnapshot,
} from '../services/reconciliation/index';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const fabric = await getOrCreateReconciliationFabric(clinicianId);
    return res.json(fabric);
  } catch (error) {
    console.error('[reconciliation] failed', error);
    return res.status(500).json({
      error: 'reconciliation_fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:clinicianId/anchor', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    await anchorReconciliationSnapshot(clinicianId);
    return res.json({ success: true, message: 'Reconciliation fabric anchored' });
  } catch (error) {
    console.error('[reconciliation] anchor failed', error);
    return res.status(500).json({
      error: 'reconciliation_anchor_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:clinicianId/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const exportData = await exportReconciliationAudit(clinicianId);
    return res.json(exportData);
  } catch (error) {
    console.error('[reconciliation] export failed', error);
    return res.status(500).json({
      error: 'reconciliation_export_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

