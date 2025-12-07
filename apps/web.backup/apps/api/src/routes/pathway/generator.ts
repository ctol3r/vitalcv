import { Router, type Request, type Response } from 'express';
import {
  generatePathwayPlan,
  generateMultiRolePathways,
  exportPathwayReport,
} from '../../services/pathway/generator';
import { anchorEvent } from '../../services/audit/anchor';
import { createHash } from 'crypto';

const router = Router();

router.get('/:clinicianId/:targetRole', async (req: Request, res: Response) => {
  try {
    const { clinicianId, targetRole } = req.params;
    const plan = await generatePathwayPlan(clinicianId, targetRole);
    return res.json(plan);
  } catch (error) {
    console.error('[pathway:plan] failed', error);
    return res.status(500).json({
      error: 'pathway_plan_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/:clinicianId/multi-role', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const { targetRoles } = req.body;
    if (!Array.isArray(targetRoles)) {
      return res.status(400).json({ error: 'invalid_target_roles' });
    }
    const pathways = await generateMultiRolePathways(clinicianId, targetRoles);
    return res.json(pathways);
  } catch (error) {
    console.error('[pathway:multi] failed', error);
    return res.status(500).json({
      error: 'multi_pathway_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:clinicianId/:targetRole/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId, targetRole } = req.params;
    const report = await exportPathwayReport(clinicianId, targetRole);

    // Anchor the pathway
    const pathwayHash = createHash('sha256')
      .update(JSON.stringify(report))
      .digest('hex');

    anchorEvent('pathwayAnchored', {
      clinicianId,
      targetRole,
      pathwayHash,
      estimatedDays: report.timeline.estimatedDays,
    });

    return res.json(report);
  } catch (error) {
    console.error('[pathway:export] failed', error);
    return res.status(500).json({
      error: 'pathway_export_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;

