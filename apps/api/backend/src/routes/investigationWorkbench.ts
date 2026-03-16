import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  buildEvidenceViewerPayload,
  listInvestigationFeed,
} from '../services/investigation/investigationWorkbenchService';
import {
  buildLearningCalibrationReport,
  recordInvestigatorLearningFeedback,
} from '../services/investigation/investigatorLearningService';

function readLimit(value: unknown, fallback: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, 100);
}

export function registerInvestigationWorkbenchRoutes(app: Express): void {
  app.get('/api/investigations/feed', async (req: Request, res: Response) => {
    try {
      const payload = await listInvestigationFeed({
        entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
        entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
        limit: readLimit(req.query.limit, 40),
      });

      res.json({
        schema: 'https://vitalcv.com/investigations/feed/v1',
        ...payload,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'investigations.feed_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load investigation feed', detail });
    }
  });

  app.get('/api/evidence/:id', async (req: Request, res: Response) => {
    try {
      const payload = await buildEvidenceViewerPayload(req.params.id);
      if (!payload) {
        res.status(404).json({ error: 'Evidence not found' });
        return;
      }

      res.json({
        schema: 'https://vitalcv.com/evidence/viewer/v1',
        ...payload,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'evidence.viewer_failed', { error: detail, evidenceId: req.params.id });
      res.status(500).json({ error: 'Failed to load evidence', detail });
    }
  });

  app.get('/api/learning/calibration', async (_req: Request, res: Response) => {
    try {
      res.json({
        schema: 'https://vitalcv.com/learning/calibration/v1',
        ...(await buildLearningCalibrationReport()),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'learning.calibration_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load learning calibration', detail });
    }
  });

  app.post('/api/learning/feedback', async (req: Request, res: Response) => {
    const resolution = typeof req.body?.resolution === 'string' ? req.body.resolution : null;
    const findingId = typeof req.body?.findingId === 'string' ? req.body.findingId : null;

    if (!findingId || !resolution) {
      res.status(400).json({ error: 'findingId and resolution are required' });
      return;
    }

    try {
      const result = await recordInvestigatorLearningFeedback({
        findingId,
        resolution: resolution as Parameters<typeof recordInvestigatorLearningFeedback>[0]['resolution'],
        actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : null,
        note: typeof req.body?.note === 'string' ? req.body.note : null,
        rootCause: typeof req.body?.rootCause === 'string' ? req.body.rootCause : null,
        manualDiscoveryGap: req.body?.manualDiscoveryGap === true,
        metadata: req.body?.metadata && typeof req.body.metadata === 'object'
          ? req.body.metadata as Record<string, unknown>
          : undefined,
      });

      res.status(201).json({
        schema: 'https://vitalcv.com/learning/feedback/v1',
        ...result,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (detail.includes('not found')) {
        res.status(404).json({ error: 'Finding not found' });
        return;
      }
      log('error', 'learning.feedback_failed', { error: detail, findingId });
      res.status(500).json({ error: 'Failed to record learning feedback', detail });
    }
  });
}
