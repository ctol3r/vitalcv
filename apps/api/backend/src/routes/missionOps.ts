/**
 * missionOps.ts — Wave 123: Mission Ops + Conversion Engine
 *
 * GET  /api/mission-ops/overview              — Full mission ops overview
 * GET  /api/mission-ops/sources               — Live source ops health report
 * GET  /api/mission-ops/onboarding            — List all onboarding flows
 * GET  /api/mission-ops/onboarding/:role      — List flows by role
 * POST /api/mission-ops/onboarding            — Create onboarding flow
 * PATCH /api/mission-ops/onboarding/:role/:entityId/stage — Update stage
 *
 * AUTHORIZATION (2026-08-08). This whole family sat behind the global tenant
 * guard, which accepted the mere PRESENCE of a caller-supplied `x-org-id`, and
 * none of these handlers reads the org — so the header was a turnstile token,
 * not a scope. `/api/mission-ops/sources` is the endpoint the G1 report opened
 * with: 401 anonymous, 200 (~14 KB of source/connector health and governance
 * telemetry) with any header. The POST and PATCH are worse in kind: anonymous
 * WRITES to onboarding stage state.
 *
 * Operator secret, which is the disposition #1210 already chose for this exact
 * data at the web edge (both proxies machine-authenticate their callers).
 *
 * This breaks nothing, because nothing currently works: all three callers of
 * /api/mission-ops/sources fetch the backend with NO headers at all
 * (`app/api/internal/mission-ops/sources`, `app/api/internal/source-health`,
 * `lib/status/sourceOps.ts`), so all three have been receiving 401 and the one
 * live consumer, `lib/trust/sourceLanes.ts`, has been serving its declared
 * fallback — the one that says in as many words that it is not a fresh runtime
 * heartbeat. The proxies are fixed in this change to forward the secret, which
 * makes the operator path work for the first time.
 */

import type { Express, Request, Response } from 'express';
import {
  computeMissionOpsOverview,
  listOnboardingFlows,
  getOrCreateOnboardingFlow,
  initializeOnboardingFlowsPersistence,
  updateOnboardingStage,
  type OnboardingRole,
  type StageStatus,
} from '../services/missionOps/onboardingFlows';
import { initializeTrustRegistryPersistence } from '../services/registry/trustRegistry';
import { requireInternalSecret } from '../middleware/internalSecret';
import { log } from '../obs/logger';
import { getSDKDiagnosticsReport } from '../services/missionOps/sdkDiagnosticsService';
import { computeSourceOpsReport } from '../services/missionOps/sourceOpsService';

const VALID_ROLES: OnboardingRole[] = ['ISSUER', 'VERIFIER', 'PARTNER'];
const VALID_STATUSES: StageStatus[] = ['COMPLETE', 'IN_PROGRESS', 'PENDING', 'BLOCKED'];

export function registerMissionOpsRoutes(app: Express): void {
  // Wave 133: SDK diagnostics
  app.get('/api/mission-ops/sdk-diagnostics', requireInternalSecret, async (_req: Request, res: Response) => {
    try {
      const report = await getSDKDiagnosticsReport();
      res.json(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'mission_ops: sdk_diagnostics failed', { error: msg });
      res.status(500).json({ error: 'SDK diagnostics failed' });
    }
  });
  app.get('/api/mission-ops/overview', requireInternalSecret, async (_req: Request, res: Response) => {
    try {
      await Promise.all([
        initializeOnboardingFlowsPersistence(),
        initializeTrustRegistryPersistence(),
      ]);
      res.json(computeMissionOpsOverview());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'mission_ops: overview failed', { error: msg });
      res.status(500).json({ error: 'Failed to compute overview' });
    }
  });

  app.get('/api/mission-ops/sources', requireInternalSecret, async (_req: Request, res: Response) => {
    try {
      const report = await computeSourceOpsReport();
      res.json(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'mission_ops: sources failed', { error: msg });
      res.status(500).json({ error: 'Failed to compute source ops report' });
    }
  });

  app.get('/api/mission-ops/onboarding', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      await initializeOnboardingFlowsPersistence();
      const role = req.query.role as string | undefined;
      if (role && !VALID_ROLES.includes(role as OnboardingRole)) {
        res.status(400).json({ error: `Invalid role. Valid: ${VALID_ROLES.join(', ')}` });
        return;
      }
      res.json({ flows: listOnboardingFlows(role as OnboardingRole | undefined) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'mission_ops: onboarding list failed', { error: msg });
      res.status(500).json({ error: 'Failed to list onboarding flows' });
    }
  });

  app.get('/api/mission-ops/onboarding/:role', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      await initializeOnboardingFlowsPersistence();
      const role = req.params.role?.toUpperCase() as OnboardingRole;
      if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ error: `Invalid role. Valid: ${VALID_ROLES.join(', ')}` });
        return;
      }
      res.json({ flows: listOnboardingFlows(role) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'mission_ops: role list failed', { error: msg });
      res.status(500).json({ error: 'Failed to list onboarding flows' });
    }
  });

  app.post('/api/mission-ops/onboarding', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      const { role, entityId, entityName } = req.body ?? {};
      if (!role || !VALID_ROLES.includes(role)) {
        res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(', ')}` });
        return;
      }
      if (!entityId || !entityName) {
        res.status(400).json({ error: 'entityId and entityName are required' });
        return;
      }
      const flow = await getOrCreateOnboardingFlow(role, entityId, entityName);
      res.status(201).json(flow);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'mission_ops: onboarding create failed', { error: msg });
      res.status(500).json({ error: 'Failed to create onboarding flow' });
    }
  });

  app.patch('/api/mission-ops/onboarding/:role/:entityId/stage', requireInternalSecret, async (req: Request, res: Response) => {
    try {
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

      const flow = await updateOnboardingStage(role, entityId, stageId, status, blockedReason);
      if (!flow) {
        res.status(404).json({ error: 'Onboarding flow or stage not found' });
        return;
      }
      res.json(flow);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'mission_ops: stage update failed', { error: msg });
      res.status(500).json({ error: 'Failed to update onboarding flow' });
    }
  });
}
