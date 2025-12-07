import { Router, type Request, type Response } from 'express';
import {
  getPerformanceStability,
  getStabilityScore,
  exportStabilityReport,
  anchorStabilitySnapshot,
} from '@/services/stability/performanceStability';

const router = Router();

/**
 * Task 359.4 — Performance stability UI endpoint
 */
router.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const stability = await getPerformanceStability(orgId);
    return res.json(stability);
  } catch (error) {
    console.error('[PerformanceStability] Get failed', error);
    return res.status(500).json({ error: 'get_failed' });
  }
});

router.get('/:orgId/score', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const score = await getStabilityScore(orgId);
    return res.json({ score });
  } catch (error) {
    console.error('[PerformanceStability] Score failed', error);
    return res.status(500).json({ error: 'score_failed' });
  }
});

router.get('/:orgId/export', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const report = await exportStabilityReport(orgId);
    return res.json(report);
  } catch (error) {
    console.error('[PerformanceStability] Export failed', error);
    return res.status(500).json({ error: 'export_failed' });
  }
});

router.post('/:orgId/anchor', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const txHash = await anchorStabilitySnapshot(orgId);
    return res.json({ txHash, anchoredAt: new Date().toISOString() });
  } catch (error) {
    console.error('[PerformanceStability] Anchor failed', error);
    return res.status(500).json({ error: 'anchor_failed' });
  }
});

export default router;

