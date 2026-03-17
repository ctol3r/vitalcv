import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { runTargetedInvestigators } from '../services/investigators/investigatorEngineService';
import { getInvestigatorSchedulerState } from '../services/investigators/investigatorScheduler';
import { IGNITION_INVESTIGATOR_IDS } from '../services/investigators/ignitionInvestigators';
import {
  getAutonomousInvestigatorStatus,
} from '../services/investigators/autonomousInvestigatorEngine';

function normalizeTargetEntityIds(req: Request): string[] {
  const body = req.body as {
    npi?: string | string[];
    targetEntityIds?: string[];
  } | undefined;

  const npis = typeof body?.npi === 'string'
    ? [body.npi]
    : Array.isArray(body?.npi)
      ? body.npi
      : [];
  const targetEntityIds = Array.isArray(body?.targetEntityIds) ? body.targetEntityIds : [];
  return [...new Set([...npis, ...targetEntityIds].filter((value) => /^\d{10}$/.test(value)))];
}

export function registerInvestigatorApiRoutes(app: Express): void {
  app.post('/api/investigator/run', async (req: Request, res: Response) => {
    const body = req.body as {
      investigatorIds?: string[];
      entityType?: string;
    } | undefined;
    const investigatorIds = Array.isArray(body?.investigatorIds) && body.investigatorIds.length > 0
      ? body.investigatorIds
      : [...IGNITION_INVESTIGATOR_IDS];
    const targetEntityIds = normalizeTargetEntityIds(req);

    try {
      const results = await runTargetedInvestigators({
        entityType: body?.entityType ?? 'provider',
        targetEntityIds,
        investigatorIds,
        trigger: 'manual',
        metadata: {
          source: 'api_investigator_run',
        },
      });

      res.json({
        schema: 'https://vitalcv.com/investigator-run/v1',
        investigatorIds,
        targetEntityIds,
        runs: results,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', 'investigator_api_run_failed', { error: message });
      res.status(500).json({ error: 'Failed to run investigator engine', detail: message });
    }
  });

  app.get('/api/investigator/status', async (_req: Request, res: Response) => {
    try {
      const [scheduler, autonomous] = await Promise.all([
        Promise.resolve(getInvestigatorSchedulerState()),
        getAutonomousInvestigatorStatus(prisma),
      ]);

      res.json({
        schema: 'https://vitalcv.com/investigator-status/v1',
        scheduler,
        jobs: autonomous.jobs,
        sources: autonomous.sources,
        investigatorCount: IGNITION_INVESTIGATOR_IDS.length,
        ignitionInvestigators: [...IGNITION_INVESTIGATOR_IDS],
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', 'investigator_api_status_failed', { error: message });
      res.status(500).json({ error: 'Failed to load investigator status', detail: message });
    }
  });
}
