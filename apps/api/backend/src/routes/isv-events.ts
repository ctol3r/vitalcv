/**
 * ISV Events API — wave-122
 *
 * Records events for the full clinician loop:
 *   readiness.viewed → passport.viewed → review.opened → action.taken → state.updated
 *
 * Computes time_to_first_action and readiness_to_action delta.
 * This is the first measurable ISV proxy.
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

export const isvEventsRouter = Router();

// ─── In-process loop store ────────────────────────────────────────

interface ISVLoopRecord {
  loopId: string;
  npi: string;
  events: ISVEventRecord[];
  startedAt: number;
}

interface ISVEventRecord {
  eventId: string;
  loopId: string;
  eventType: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

const isvLoops = new Map<string, ISVLoopRecord>();

// ─── POST /api/isv-events ─────────────────────────────────────────

/**
 * Record a single ISV event.
 * Body: { loopId?, npi, eventType, payload? }
 * Returns: { eventId, loopId, timings? }
 */
isvEventsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { npi, eventType, payload = {}, loopId: existingLoopId } = req.body;

    if (!npi || !eventType) {
      return res.status(400).json({ error: 'npi and eventType required' });
    }

    const VALID_EVENTS = new Set([
      'readiness.viewed',
      'passport.viewed',
      'review.opened',
      'action.taken',
      'state.updated',
    ]);

    if (!VALID_EVENTS.has(eventType)) {
      return res.status(400).json({ error: `Invalid eventType: ${eventType}` });
    }

    // Get or create loop
    let loop: ISVLoopRecord;
    if (existingLoopId && isvLoops.has(existingLoopId)) {
      loop = isvLoops.get(existingLoopId)!;
    } else {
      loop = {
        loopId: existingLoopId ?? `isv-${Date.now()}-${randomUUID().slice(0, 8)}`,
        npi,
        events: [],
        startedAt: Date.now(),
      };
      isvLoops.set(loop.loopId, loop);
    }

    const event: ISVEventRecord = {
      eventId: `isv-evt-${randomUUID().slice(0, 8)}`,
      loopId: loop.loopId,
      eventType,
      timestamp: Date.now(),
      payload,
    };

    loop.events.push(event);

    // Also write to audit table for persistence
    try {
      await prisma.auditEvent.create({
        data: {
          type: `isv.${eventType}`,
          hash: randomUUID(),
          referenceId: loop.loopId,
          clinicianId: npi,
          metadata: {
            eventType,
            loopId: loop.loopId,
            eventId: event.eventId,
            ...payload,
          },
        },
      });
    } catch {
      // Non-blocking — ISV event recorded in memory even if DB write fails
      log('warn', 'isv_audit_write_failed', { loopId: loop.loopId, eventType });
    }

    // Compute timings if loop is complete enough
    const timings = computeTimings(loop.events);

    log('info', 'isv_event_recorded', {
      loopId: loop.loopId,
      eventType,
      eventCount: loop.events.length,
    });

    return res.json({
      eventId: event.eventId,
      loopId: loop.loopId,
      eventCount: loop.events.length,
      timings: timings ?? undefined,
    });
  } catch (err: any) {
    log('error', 'isv_event_failed', { error: err.constructor?.name });
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ─── GET /api/isv-events/:loopId ─────────────────────────────────

isvEventsRouter.get('/:loopId', (req: Request, res: Response) => {
  const loop = isvLoops.get(req.params.loopId);
  if (!loop) return res.status(404).json({ error: 'Loop not found' });

  return res.json({
    loopId: loop.loopId,
    npi: loop.npi,
    startedAt: loop.startedAt,
    eventCount: loop.events.length,
    events: loop.events,
    timings: computeTimings(loop.events),
    missingSteps: getMissingSteps(loop.events),
  });
});

// ─── Timing Computation ───────────────────────────────────────────

function computeTimings(events: ISVEventRecord[]) {
  const byType = new Map(events.map(e => [e.eventType, e.timestamp]));

  const readinessViewed = byType.get('readiness.viewed');
  const passportViewed  = byType.get('passport.viewed');
  const reviewOpened    = byType.get('review.opened');
  const actionTaken     = byType.get('action.taken');

  if (!readinessViewed) return null;

  return {
    readiness_to_passport_ms:  passportViewed  ? passportViewed - readinessViewed  : null,
    passport_to_review_ms:     reviewOpened    ? reviewOpened   - passportViewed!  : null,
    review_to_action_ms:       actionTaken     ? actionTaken    - reviewOpened!    : null,
    readiness_to_action_ms:    actionTaken     ? actionTaken    - readinessViewed  : null,
    time_to_first_action_ms:   actionTaken     ? actionTaken    - readinessViewed  : null,
    // Human-readable
    readiness_to_action_min:   actionTaken
      ? Math.round((actionTaken - readinessViewed) / 6000) / 10
      : null,
  };
}

function getMissingSteps(events: ISVEventRecord[]): string[] {
  const all = ['readiness.viewed', 'passport.viewed', 'review.opened', 'action.taken', 'state.updated'];
  const seen = new Set(events.map(e => e.eventType));
  return all.filter(s => !seen.has(s));
}
