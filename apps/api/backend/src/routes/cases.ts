import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { listCases, getCaseDetail } from '../services/cases/caseService';
import {
  saveActionRecommendation,
  executeActionRecommendation,
} from '../services/actions/actionEngineService';

export function registerCasesRoutes(app: Express): void {
  /**
   * GET /api/cases
   * Returns all clinician credentialing cases with blockers, actions, and progress.
   * Supports ?sort=priority|delay|roi and ?priority=critical|high|medium|low filter.
   */
  app.get('/api/cases', async (req: Request, res: Response) => {
    try {
      const cases = await listCases();

      const priorityFilter = typeof req.query.priority === 'string'
        ? req.query.priority.split(',').map((p) => p.trim())
        : [];

      const filtered = priorityFilter.length > 0
        ? cases.filter((c) => priorityFilter.includes(c.priority))
        : cases;

      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'priority';
      const sorted = sortCases(filtered, sort);

      res.json({
        schema: 'https://vitalcv.com/cases/v1',
        total: sorted.length,
        cases: sorted,
      });
    } catch (error) {
      log('error', 'cases: list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load cases' });
    }
  });

  /**
   * GET /api/case/:entityId
   * Returns a single clinician case with full orchestration plan.
   */
  app.get('/api/case/:entityId', async (req: Request, res: Response) => {
    try {
      const { entityId } = req.params as { entityId: string };
      const clinicalCase = await getCaseDetail(entityId);

      if (!clinicalCase) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      res.json({
        schema: 'https://vitalcv.com/case-detail/v1',
        case: clinicalCase,
      });
    } catch (error) {
      log('error', 'cases: detail failed', {
        error: error instanceof Error ? error.message : String(error),
        entityId: req.params.entityId,
      });
      res.status(500).json({ error: 'Failed to load case' });
    }
  });

  /**
   * POST /api/case/:entityId/action/:actionId/start
   * Transitions an action to in_progress.
   */
  app.post('/api/case/:entityId/action/:actionId/start', async (req: Request, res: Response) => {
    const { entityId, actionId } = req.params as { entityId: string; actionId: string };
    const body = req.body as { actorId?: unknown; note?: unknown } | undefined;
    const actorId = typeof body?.actorId === 'string' ? body.actorId : null;
    const note = typeof body?.note === 'string' ? body.note : null;

    try {
      const action = await saveActionRecommendation(actionId, { actorId, note });
      res.json({ entityId, action });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start action';
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Action not found' });
        return;
      }
      if (message.includes('Invalid action status transition')) {
        res.status(409).json({ error: message });
        return;
      }
      log('error', 'cases: action start failed', { error: message, entityId, actionId });
      res.status(500).json({ error: 'Failed to start action' });
    }
  });

  /**
   * POST /api/case/:entityId/action/:actionId/complete
   * Transitions an action to completed.
   */
  app.post('/api/case/:entityId/action/:actionId/complete', async (req: Request, res: Response) => {
    const { entityId, actionId } = req.params as { entityId: string; actionId: string };
    const body = req.body as { actorId?: unknown; note?: unknown } | undefined;
    const actorId = typeof body?.actorId === 'string' ? body.actorId : null;
    const note = typeof body?.note === 'string' ? body.note : null;

    try {
      const action = await executeActionRecommendation(actionId, { actorId, note });
      res.json({ entityId, action });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete action';
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Action not found' });
        return;
      }
      if (message.includes('Invalid action status transition')) {
        res.status(409).json({ error: message });
        return;
      }
      if (message.includes('unresolved dependencies')) {
        res.status(409).json({ error: message });
        return;
      }
      log('error', 'cases: action complete failed', { error: message, entityId, actionId });
      res.status(500).json({ error: 'Failed to complete action' });
    }
  });
}

const PRIORITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function sortCases(
  cases: ReturnType<typeof Array.prototype.filter>,
  sort: string,
): typeof cases {
  return [...cases].sort((a, b) => {
    switch (sort) {
      case 'delay':
        return b.orchestrationPlan.criticalPathDays - a.orchestrationPlan.criticalPathDays;
      case 'roi':
        return b.orchestrationPlan.parallelSavingsDays - a.orchestrationPlan.parallelSavingsDays;
      case 'progress':
        return a.progressPercent - b.progressPercent;
      case 'priority':
      default:
        return (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    }
  });
}
