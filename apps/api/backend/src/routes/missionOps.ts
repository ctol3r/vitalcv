/**
 * missionOps.ts — Wave 123: Mission Ops + Conversion Engine
 *
 * GET  /api/mission-ops/overview              — Full mission ops overview
 * GET  /api/mission-ops/onboarding            — List all onboarding flows
 * GET  /api/mission-ops/onboarding/:role      — List flows by role
 * POST /api/mission-ops/onboarding            — Create onboarding flow
 * PATCH /api/mission-ops/onboarding/:role/:entityId/stage — Update stage
 */

import type { Express, Request, Response } from 'express';
import {
  computeMissionOpsOverview,
  listOnboardingFlows,
  getOrCreateOnboardingFlow,
  updateOnboardingStage,
  type OnboardingRole,
  type StageStatus,
} from '../services/missionOps/onboardingFlows';
import { log } from '../obs/logger';

const VALID_ROLES: OnboardingRole[] = ['ISSUER', 'VERIFIER', 'PARTNER'];
const VALID_STATUSES: StageStatus[] = ['COMPLETE', 'IN_PROGRESS', 'PENDING', 'BLOCKED'];

export function registerMissionOpsRoutes(app: Express): void {
  app.get('/api/mission-ops/overview', (_req: Request, res: Response) => {
    try {
      res.json(computeMissionOpsOverview());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'mission_ops: overview failed', { error: msg });
      res.status(500).json({ error: 'Failed to compute overview' });
    }
  });

  app.get('/api/mission-ops/onboarding', (req: Request, res: Response) => {
    const role = req.query.role as string | undefined;
    if (role && !VALID_ROLES.includes(role as OnboardingRole)) {
      res.status(400).json({ error: `Invalid role. Valid: ${VALID_ROLES.join(', ')}` });
      return;
    }
    res.json({ flows: listOnboardingFlows(role as OnboardingRole | undefined) });
  });

  app.get('/api/mission-ops/onboarding/:role', (req: Request, res: Response) => {
    const role = req.params.role?.toUpperCase() as OnboardingRole;
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `Invalid role. Valid: ${VALID_ROLES.join(', ')}` });
      return;
    }
    res.json({ flows: listOnboardingFlows(role) });
  });

  app.post('/api/mission-ops/onboarding', (req: Request, res: Response) => {
    const { role, entityId, entityName } = req.body ?? {};
    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(', ')}` });
      return;
    }
    if (!entityId || !entityName) {
      res.status(400).json({ error: 'entityId and entityName are required' });
      return;
    }
    const flow = getOrCreateOnboardingFlow(role, entityId, entityName);
    res.status(201).json(flow);
  });

  app.patch('/api/mission-ops/onboarding/:role/:entityId/stage', (req: Request, res: Response) => {
    const role = req.params.role?.toUpperCase() as OnboardingRole;
    const { entityId } = req.params;
    const { stageId, status, blockedReason } = req.body ?? {};

    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `Invalid role. Valid: ${VALID_ROLES.join(', ')}` });
      return;
    }
    if (!stageId || !status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `stageId and valid status (${VALID_STATUSES.join(', ')}) required` });
      return;
    }

    const flow = updateOnboardingStage(role, entityId, stageId, status, blockedReason);
    if (!flow) {
      res.status(404).json({ error: 'Onboarding flow or stage not found' });
      return;
    }
    res.json(flow);
  });
}
