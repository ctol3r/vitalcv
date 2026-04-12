/**
 * learningTrack.ts — Lightweight event tracking endpoint for frontend-originated events.
 *
 * POST /api/learning/track
 * Accepts events from the frontend (JOB_CLICKED, APPLY_CLICKED, PROFILE_VIEWED, etc.)
 * Validates against an allowlist. Writes via PrismaEventStore. Returns 202.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { log } from '../obs/logger';
import { emitLearningEvent } from '../services/feedback/prismaEventStore';

const ALLOWED_FRONTEND_EVENTS = new Set([
  'NPI_CHECKED',
  'PROFILE_VIEWED',
  'JOB_CLICKED',
  'JOB_VIEWED',
  'APPLY_CLICKED',
  'EMPLOYER_VIEWED',
]);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export function registerLearningTrackRoutes(app: Express): void {
  app.post(
    '/api/learning/track',
    asyncHandler(async (req, res) => {
      const { type, providerId, jobId, employerId, metadata } = req.body as {
        type?: string;
        providerId?: string;
        jobId?: string;
        employerId?: string;
        metadata?: Record<string, unknown>;
      };

      if (!type || !ALLOWED_FRONTEND_EVENTS.has(type)) {
        return void res.status(400).json({
          error: 'invalid_event_type',
          error_description: `Event type must be one of: ${[...ALLOWED_FRONTEND_EVENTS].join(', ')}`,
        });
      }

      if (!providerId?.trim()) {
        return void res.status(400).json({
          error: 'missing_provider_id',
          error_description: 'providerId is required.',
        });
      }

      emitLearningEvent({
        type,
        timestamp: new Date(),
        providerId: providerId.trim(),
        jobId: jobId?.trim() ?? '',
        employerId: employerId?.trim() ?? '',
        metadata: metadata ?? {},
        payload: metadata ?? {},
      });

      return void res.status(202).json({ ok: true });
    }),
  );

  log('info', 'learning_track_routes_registered', {
    routes: ['POST /api/learning/track'],
  });
}
