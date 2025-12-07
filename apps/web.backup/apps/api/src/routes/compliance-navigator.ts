import { Router, type Request, type Response } from 'express';
import { getComplianceNavigator, anchorComplianceNavigator } from '../services/compliance-navigator';

const router = Router();

router.get('/compliance-navigator/:orgId', async (req: Request, res: Response) => {
  const orgId = req.params.orgId?.trim();
  if (!orgId) {
    return res.status(400).json({
      error: 'org_id_required',
      message: 'Provide an orgId parameter.',
    });
  }

  try {
    const navigator = await getComplianceNavigator(orgId);
    await anchorComplianceNavigator(orgId, navigator);
    return res.json(navigator);
  } catch (error) {
    console.error('[compliance-navigator] failed', error);
    return res.status(500).json({
      error: 'compliance_navigator_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;








