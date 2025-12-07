import { Router, type Request, type Response } from 'express';
import {
  getOrCreateEmployerOnboarding,
  setupATSQuickConnect,
  setupAutoVerifyIntegration,
  recommendOrgRoles,
  projectTimeToFirstVerification,
  runOnboardingSafetyChecks,
} from '../../services/onboarding/employer';
import { anchorEvent } from '../../services/audit/anchor';
import { createHash } from 'crypto';

const router = Router();

router.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const onboarding = await getOrCreateEmployerOnboarding(orgId);
    return res.json(onboarding);
  } catch (error) {
    console.error('[onboarding:employer] failed', error);
    return res.status(500).json({
      error: 'onboarding_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/:orgId/ats-connect', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { atsType, apiKey, apiUrl } = req.body;
    const result = await setupATSQuickConnect(orgId, atsType, apiKey, apiUrl);
    return res.json(result);
  } catch (error) {
    console.error('[onboarding:ats] failed', error);
    return res.status(500).json({
      error: 'ats_connect_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/:orgId/auto-verify', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const result = await setupAutoVerifyIntegration(orgId);
    return res.json(result);
  } catch (error) {
    console.error('[onboarding:auto-verify] failed', error);
    return res.status(500).json({
      error: 'auto_verify_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:orgId/recommend-roles', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const roles = await recommendOrgRoles(orgId);
    return res.json({ roles });
  } catch (error) {
    console.error('[onboarding:roles] failed', error);
    return res.status(500).json({
      error: 'role_recommendation_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:orgId/project-verification', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const projection = await projectTimeToFirstVerification(orgId);
    return res.json(projection);
  } catch (error) {
    console.error('[onboarding:projection] failed', error);
    return res.status(500).json({
      error: 'projection_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/:orgId/safety-checks', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const checks = await runOnboardingSafetyChecks(orgId);
    return res.json(checks);
  } catch (error) {
    console.error('[onboarding:safety] failed', error);
    return res.status(500).json({
      error: 'safety_checks_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.post('/:orgId/anchor', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const onboarding = await getOrCreateEmployerOnboarding(orgId);

    const snapshotHash = createHash('sha256')
      .update(JSON.stringify(onboarding))
      .digest('hex');

    anchorEvent('employerOnboardingAnchored', {
      orgId,
      snapshotHash,
      status: onboarding.status,
      progress: onboarding.progress,
    });

    return res.json({ success: true, hash: snapshotHash });
  } catch (error) {
    console.error('[onboarding:anchor] failed', error);
    return res.status(500).json({
      error: 'onboarding_anchor_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;

