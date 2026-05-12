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

function readClerkUserId(req: Request): string | null {
  const value = req.headers['x-clerk-user-id'];
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim() || null;
  return null;
}

export function registerLearningTrackRoutes(app: Express): void {
  app.post(
    '/api/learning/track',
    asyncHandler(async (req, res) => {
      // ── Actor continuity enforcement ────────────────────────────────
      // No durable learning event write may occur without an attributable actor.
      // All callers must route through an auth-injecting proxy (e.g. /api/track/apply).
      const actorId = readClerkUserId(req);
      if (!actorId) {
        return void res.status(401).json({
          error: 'Unauthorized',
          error_description: 'x-clerk-user-id header is required. Route all tracking calls through an authenticated proxy.',
        });
      }

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

      // Attach actor_id to metadata for replay lineage and snapshot attribution.
      const enrichedMetadata: Record<string, unknown> = {
        ...(metadata ?? {}),
        actor_id: actorId,
      };

      emitLearningEvent({
        type,
        timestamp: new Date(),
        providerId: providerId.trim(),
        jobId: jobId?.trim() ?? '',
        employerId: employerId?.trim() ?? '',
        metadata: enrichedMetadata,
        payload: enrichedMetadata,
      });

      return void res.status(202).json({ ok: true });
    }),
  );

  log('info', 'learning_track_routes_registered', {
    routes: ['POST /api/learning/track'],
  });
}
