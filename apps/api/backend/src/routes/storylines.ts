import type { Express, Request, Response } from 'express';
import {
  acknowledgeStoryline,
  archiveStoryline,
  escalateStoryline,
  getStorylineDetail,
  listStorylines,
  saveStorylineInvestigation,
} from '../services/storylines/storylineService';
import type { StorylineQueryFilters } from '../services/storylines/storylineService';
import {
  storylineDetailResponseSchema,
  storylineListResponseSchema,
} from '../services/storylines/contracts';
import { log } from '../obs/logger';
import { buildStorylineInvestigationPayload as buildWorkbenchStorylinePayload } from '../services/investigation/investigationWorkbenchService';

const NPI_RE = /^\d{10}$/;
const VALID_FEEDBACK = new Set([
  'acknowledge',
  'dismiss',
  'escalate',
  'archive',
  'save',
  'compare',
  'follow_up',
]);

function readQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return first?.trim();
  }

  return undefined;
}

function readLimit(value: unknown): number | undefined {
  const raw = readQueryValue(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function readSync(value: unknown): boolean {
  return readQueryValue(value) !== 'false';
}

function summarizeStorylines(storylines: Awaited<ReturnType<typeof listStorylines>>['storylines']): {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
} {
  const byStatus: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const storyline of storylines) {
    byStatus[storyline.status] = (byStatus[storyline.status] ?? 0) + 1;
    bySeverity[storyline.severity] = (bySeverity[storyline.severity] ?? 0) + 1;
    byType[storyline.storylineType] = (byType[storyline.storylineType] ?? 0) + 1;
  }

  return {
    total: storylines.length,
    byStatus,
    bySeverity,
    byType,
  };
}

export function registerStorylineRoutes(app: Express): void {
  app.get('/api/storylines', async (req: Request, res: Response) => {
    try {
      const result = await listStorylines({
        storylineType: readQueryValue(req.query.storylineType) as StorylineQueryFilters['storylineType'],
        severity: readQueryValue(req.query.severity) as StorylineQueryFilters['severity'],
        status: readQueryValue(req.query.status) as StorylineQueryFilters['status'],
        provider: readQueryValue(req.query.provider),
        institution: readQueryValue(req.query.institution),
        perspective: readQueryValue(req.query.perspective) as StorylineQueryFilters['perspective'],
        dateFrom: readQueryValue(req.query.dateFrom),
        dateTo: readQueryValue(req.query.dateTo),
        limit: readLimit(req.query.limit),
        sync: readSync(req.query.sync),
      });

      res.json(storylineListResponseSchema.parse({
        storylines: result.storylines,
        total: result.storylines.length,
        syncedAt: result.syncedAt,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_list_failed', { error: message });
      res.status(500).json({ error: 'Failed to list storylines', detail: message });
    }
  });

  app.get('/api/storylines/stats', async (req: Request, res: Response) => {
    try {
      const result = await listStorylines({
        limit: 200,
        sync: readSync(req.query.sync),
      });
      res.json({
        schema: 'https://vitalcv.com/storylines-stats/v2',
        ...summarizeStorylines(result.storylines),
        syncedAt: result.syncedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_stats_failed', { error: message });
      res.status(500).json({ error: 'Failed to summarize storylines', detail: message });
    }
  });

  app.get('/api/storylines/npi/:npi', async (req: Request, res: Response) => {
    if (!NPI_RE.test(req.params.npi)) {
      res.status(400).json({ error: 'Invalid NPI' });
      return;
    }

    try {
      const result = await listStorylines({
        provider: req.params.npi,
        limit: readLimit(req.query.limit),
        sync: readSync(req.query.sync),
      });
      res.json(storylineListResponseSchema.parse({
        storylines: result.storylines,
        total: result.storylines.length,
        syncedAt: result.syncedAt,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_npi_failed', { npi: req.params.npi, error: message });
      res.status(500).json({ error: 'Failed to list provider storylines', detail: message });
    }
  });

  app.get('/api/storylines/:id/investigation', async (req: Request, res: Response) => {
    try {
      const payload = await buildWorkbenchStorylinePayload(req.params.id);
      if (!payload) {
        res.status(404).json({ error: 'Storyline not found' });
        return;
      }

      res.json({
        schema: 'https://vitalcv.com/storylines/investigation/v1',
        ...payload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_investigation_failed', { storylineId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to load storyline investigation', detail: message });
    }
  });

  app.get('/api/storylines/:id', async (req: Request, res: Response) => {
    try {
      const detail = await getStorylineDetail(req.params.id, {
        sync: readSync(req.query.sync),
      });

      if (!detail) {
        res.status(404).json({ error: 'Storyline not found' });
        return;
      }

      res.json(storylineDetailResponseSchema.parse(detail));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_detail_failed', { storylineId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to load storyline', detail: message });
    }
  });

  app.post('/api/storylines/:id/feedback', async (req: Request, res: Response) => {
    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    if (!VALID_FEEDBACK.has(action)) {
      res.status(400).json({ error: `action must be one of: ${[...VALID_FEEDBACK].join(', ')}` });
      return;
    }

    const actorId = typeof req.body?.actorId === 'string' ? req.body.actorId : undefined;
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;

    try {
      const detail = action === 'acknowledge'
        ? await acknowledgeStoryline({ storylineId: req.params.id, actorId, note })
        : action === 'escalate'
          ? await escalateStoryline({ storylineId: req.params.id, actorId, note })
          : action === 'archive' || action === 'dismiss'
            ? await archiveStoryline({ storylineId: req.params.id, actorId, note })
            : await saveStorylineInvestigation({
              storylineId: req.params.id,
              actorId,
              note,
              payload: { feedbackAction: action },
            });

      if (!detail) {
        res.status(404).json({ error: 'Storyline not found' });
        return;
      }

      res.json(storylineDetailResponseSchema.parse(detail));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_feedback_failed', { storylineId: req.params.id, action, error: message });
      res.status(500).json({ error: 'Failed to record storyline feedback', detail: message });
    }
  });

  app.post('/api/storylines/:id/acknowledge', async (req: Request, res: Response) => {
    try {
      const detail = await acknowledgeStoryline({
        storylineId: req.params.id,
        actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : undefined,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      });

      if (!detail) {
        res.status(404).json({ error: 'Storyline not found' });
        return;
      }

      res.json(storylineDetailResponseSchema.parse(detail));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_acknowledge_failed', { storylineId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to acknowledge storyline', detail: message });
    }
  });

  app.post('/api/storylines/:id/escalate', async (req: Request, res: Response) => {
    try {
      const detail = await escalateStoryline({
        storylineId: req.params.id,
        actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : undefined,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      });

      if (!detail) {
        res.status(404).json({ error: 'Storyline not found' });
        return;
      }

      res.json(storylineDetailResponseSchema.parse(detail));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_escalate_failed', { storylineId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to escalate storyline', detail: message });
    }
  });

  app.post('/api/storylines/:id/archive', async (req: Request, res: Response) => {
    try {
      const detail = await archiveStoryline({
        storylineId: req.params.id,
        actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : undefined,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      });

      if (!detail) {
        res.status(404).json({ error: 'Storyline not found' });
        return;
      }

      res.json(storylineDetailResponseSchema.parse(detail));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_archive_failed', { storylineId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to archive storyline', detail: message });
    }
  });

  app.post('/api/storylines/:id/save-investigation', async (req: Request, res: Response) => {
    try {
      const detail = await saveStorylineInvestigation({
        storylineId: req.params.id,
        actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : undefined,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
        payload: req.body?.payload && typeof req.body.payload === 'object'
          ? req.body.payload as Record<string, unknown>
          : undefined,
      });

      if (!detail) {
        res.status(404).json({ error: 'Storyline not found' });
        return;
      }

      res.json(storylineDetailResponseSchema.parse(detail));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_save_investigation_failed', { storylineId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to save storyline investigation', detail: message });
    }
  });

  app.post('/api/storylines/cluster', async (req: Request, res: Response) => {
    try {
      const result = await listStorylines({
        limit: readLimit(req.query.limit) ?? 100,
        sync: readSync(req.query.sync ?? 'true'),
      });
      res.json({
        schema: 'https://vitalcv.com/storylines-cluster/v2',
        storylines: result.storylines,
        stats: summarizeStorylines(result.storylines),
        syncedAt: result.syncedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'storylines_cluster_failed', { error: message });
      res.status(500).json({ error: 'Failed to cluster storylines', detail: message });
    }
  });
}
