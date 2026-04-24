import type { Express, Request, Response } from 'express';
import {
  dismissActionRecommendation,
  executeActionRecommendation,
  getActionRecommendation,
  listActionRecommendations,
  saveActionRecommendation,
  setActionRecommendationStatus,
} from '../services/actions/actionEngineService';
import { log } from '../obs/logger';
import { isActionStatus, normalizeActionStatus } from '../../../../../core/actions/actionHistory';

function normalizeListParam(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseDateRange(value: unknown): { dateFrom: string | null; dateTo: string | null } {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { dateFrom: null, dateTo: null };
  }

  const [dateFromRaw, dateToRaw] = value.split(',').map((entry) => entry.trim());
  return {
    dateFrom: dateFromRaw || null,
    dateTo: dateToRaw || null,
  };
}

function statusBody(req: Request): { actorId?: string | null; note?: string | null } {
  const body = req.body as { actorId?: unknown; note?: unknown } | undefined;
  return {
    actorId: typeof body?.actorId === 'string' ? body.actorId : null,
    note: typeof body?.note === 'string' ? body.note : null,
  };
}

export function registerActionsRoutes(app: Express): void {
  app.get('/api/actions', async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = parseDateRange(req.query.dateRange);
      const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
      const offset = typeof req.query.offset === 'string' ? Number.parseInt(req.query.offset, 10) : undefined;
      const result = await listActionRecommendations({
        priority: normalizeListParam(req.query.priority),
        entity: typeof req.query.entity === 'string' ? req.query.entity : null,
        actionType: normalizeListParam(req.query.actionType),
        status: normalizeListParam(req.query.status),
        dateFrom,
        dateTo,
        limit,
        offset,
      });

      res.json({
        schema: 'https://vitalcv.com/actions/v1',
        total: result.total,
        actions: result.actions,
        filters: {
          priority: normalizeListParam(req.query.priority),
          entity: typeof req.query.entity === 'string' ? req.query.entity : null,
          actionType: normalizeListParam(req.query.actionType),
          status: normalizeListParam(req.query.status),
          dateRange: typeof req.query.dateRange === 'string' ? req.query.dateRange : null,
        },
      });
    } catch (error) {
      log('error', 'actions: list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load actions' });
    }
  });

  app.get('/api/actions/:id', async (req: Request, res: Response) => {
    try {
      const action = await getActionRecommendation(req.params.id);
      if (!action) {
        res.status(404).json({ error: 'Action not found' });
        return;
      }

      res.json({
        schema: 'https://vitalcv.com/action-detail/v1',
        action,
      });
    } catch (error) {
      log('error', 'actions: detail failed', {
        error: error instanceof Error ? error.message : String(error),
        actionId: req.params.id,
      });
      res.status(500).json({ error: 'Failed to load action' });
    }
  });

  app.patch('/api/actions/:id/status', async (req: Request, res: Response) => {
    const body = req.body as { status?: unknown; actorId?: unknown; note?: unknown } | undefined;
    const rawStatus = typeof body?.status === 'string' ? body.status : null;

    if (!rawStatus || !isActionStatus(rawStatus)) {
      res.status(400).json({
        error: 'status must be one of: pending, in_progress, completed, skipped',
      });
      return;
    }

    try {
      const action = await setActionRecommendationStatus(
        req.params.id,
        normalizeActionStatus(rawStatus),
        statusBody(req),
      );
      res.json({ action });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update action status';
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
      log('error', 'actions: status update failed', { error: message, actionId: req.params.id });
      res.status(500).json({ error: 'Failed to update action status' });
    }
  });

  app.post('/api/actions/:id/execute', async (req: Request, res: Response) => {
    try {
      const action = await executeActionRecommendation(req.params.id, statusBody(req));
      res.json({ action });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute action';
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
      log('error', 'actions: execute failed', { error: message, actionId: req.params.id });
      res.status(500).json({ error: 'Failed to execute action' });
    }
  });

  app.post('/api/actions/:id/dismiss', async (req: Request, res: Response) => {
    try {
      const action = await dismissActionRecommendation(req.params.id, statusBody(req));
      res.json({ action });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to dismiss action';
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
      log('error', 'actions: dismiss failed', { error: message, actionId: req.params.id });
      res.status(500).json({ error: 'Failed to dismiss action' });
    }
  });

  app.post('/api/actions/:id/save', async (req: Request, res: Response) => {
    try {
      const action = await saveActionRecommendation(req.params.id, statusBody(req));
      res.json({ action });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save action';
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
      log('error', 'actions: save failed', { error: message, actionId: req.params.id });
      res.status(500).json({ error: 'Failed to save action' });
    }
  });
}
