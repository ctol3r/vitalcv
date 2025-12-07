import { Router, type Request, type Response } from 'express';
import {
  getComplianceImpact,
  exportImpactReport,
  anchorComplianceImpactSnapshot,
} from '@/services/compliance/complianceImpactPredictor';

const router = Router();

/**
 * Task 361.4 — Impact forecast UI endpoint
 */
router.get('/:region', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const impact = await getComplianceImpact(region);
    return res.json(impact);
  } catch (error) {
    console.error('[ComplianceImpact] Get failed', error);
    return res.status(500).json({ error: 'get_failed' });
  }
});

router.get('/:region/export', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const report = await exportImpactReport(region);
    return res.json(report);
  } catch (error) {
    console.error('[ComplianceImpact] Export failed', error);
    return res.status(500).json({ error: 'export_failed' });
  }
});

router.post('/:region/anchor', async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    const txHash = await anchorComplianceImpactSnapshot(region);
    return res.json({ txHash, anchoredAt: new Date().toISOString() });
  } catch (error) {
    console.error('[ComplianceImpact] Anchor failed', error);
    return res.status(500).json({ error: 'anchor_failed' });
  }
});

export default router;

