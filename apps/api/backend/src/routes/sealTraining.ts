/**
 * sealTraining.ts — SEAL Training Pipeline API
 *
 * Routes:
 *   POST /api/seal/events/advisory        — capture advisory outcome event
 *   POST /api/seal/events/employer-decision — capture employer decision
 *   POST /api/seal/events/blocker/open    — open a blocker resolution event
 *   POST /api/seal/events/blocker/resolve — resolve a blocker resolution event
 *   POST /api/seal/events/start-outcome   — capture a start outcome
 *
 *   GET  /api/seal/training-set           — export training rows (?from=&to=)
 *   POST /api/seal/training-set/snapshot  — create versioned snapshot
 *   GET  /api/seal/health                 — event table counts
 *
 * SAFETY CONTRACT
 * ───────────────
 * These routes ONLY write to SEAL event tables.
 * They NEVER modify source truth (claims, artifacts, credentials, readiness).
 * The training-set export includes safetyAttestation on every response.
 * Advisory outputs derived from training MUST be labeled "Based on observed patterns".
 *
 * Auth: x-clerk-user-id for write routes. Read routes (training export) require
 * the same header plus a feature-flag check.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import {
  captureAdvisoryEvent,
  captureEmployerDecision,
  captureStartOutcome,
  openBlockerEvent,
  resolveBlockerEvent,
  syncBlockerEvents,
} from '../services/seal/sealEventCapture';
import {
  buildTrainingSnapshot,
  getSealEventCounts,
} from '../services/seal/sealTrainingNormalizer';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerSealTrainingRoutes(app: Express): void {

  // ── POST /api/seal/events/advisory ─────────────────────────────────────
  app.post('/api/seal/events/advisory', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);
    const {
      entityId, organizationContextId, advisoryVersion, eventType,
      blockersAtEvent, readinessScoreAtEvent, sourceCoverageAtEvent,
      advisoryInputSnapshotRef, advisoryOutputSnapshotRef, metadata,
    } = req.body ?? {};

    if (!entityId || !UUID_RE.test(entityId)) throw new HttpError(400, 'entityId must be a valid UUID.');
    if (!eventType) throw new HttpError(400, 'eventType is required.');

    // Fire-and-forget — caller does not need to wait
    void captureAdvisoryEvent({
      entityId,
      organizationContextId: organizationContextId ?? null,
      advisoryVersion:       advisoryVersion ?? 'unknown',
      eventType,
      blockersAtEvent:       Array.isArray(blockersAtEvent) ? blockersAtEvent : [],
      readinessScoreAtEvent: typeof readinessScoreAtEvent === 'number' ? readinessScoreAtEvent : null,
      sourceCoverageAtEvent: sourceCoverageAtEvent ?? {},
      advisoryInputSnapshotRef,
      advisoryOutputSnapshotRef,
      metadata,
    });

    void res.status(202).json({ ok: true, queued: true });
  }));

  // ── POST /api/seal/events/employer-decision ────────────────────────────
  app.post('/api/seal/events/employer-decision', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);
    const {
      entityId, organizationContextId, decision, reviewerRole,
      auditEventId, trustSnapshotAtDecision, blockersAtDecision,
      readinessScoreAtDecision, metadata,
    } = req.body ?? {};

    if (!entityId || !UUID_RE.test(entityId)) throw new HttpError(400, 'entityId must be a valid UUID.');
    if (!decision) throw new HttpError(400, 'decision is required.');

    void captureEmployerDecision({
      entityId,
      organizationContextId: organizationContextId ?? null,
      decision,
      reviewerRole:           reviewerRole ?? 'EMPLOYER',
      auditEventId:           auditEventId ?? null,
      trustSnapshotAtDecision: trustSnapshotAtDecision ?? {},
      blockersAtDecision:      Array.isArray(blockersAtDecision) ? blockersAtDecision : [],
      readinessScoreAtDecision: typeof readinessScoreAtDecision === 'number' ? readinessScoreAtDecision : null,
      metadata,
    });

    void res.status(202).json({ ok: true, queued: true });
  }));

  // ── POST /api/seal/events/blocker/open ─────────────────────────────────
  app.post('/api/seal/events/blocker/open', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);
    const { entityId, blockerCode, metadata } = req.body ?? {};

    if (!entityId || !UUID_RE.test(entityId)) throw new HttpError(400, 'entityId must be a valid UUID.');
    if (!blockerCode) throw new HttpError(400, 'blockerCode is required.');

    const id = await openBlockerEvent({ entityId, blockerCode, metadata });
    void res.status(201).json({ ok: true, blockerEventId: id });
  }));

  // ── POST /api/seal/events/blocker/resolve ──────────────────────────────
  app.post('/api/seal/events/blocker/resolve', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);
    const { blockerEventId, resolutionMethod, metadata } = req.body ?? {};

    if (!blockerEventId) throw new HttpError(400, 'blockerEventId is required.');

    void resolveBlockerEvent({
      blockerEventId,
      resolutionMethod: resolutionMethod ?? 'UNKNOWN',
      metadata,
    });

    void res.status(202).json({ ok: true, queued: true });
  }));

  // ── POST /api/seal/events/blocker/sync ────────────────────────────────
  // Sync the full current blocker list for an entity — auto-opens/resolves.
  app.post('/api/seal/events/blocker/sync', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);
    const { entityId, blockerCodes } = req.body ?? {};

    if (!entityId || !UUID_RE.test(entityId)) throw new HttpError(400, 'entityId must be a valid UUID.');
    if (!Array.isArray(blockerCodes)) throw new HttpError(400, 'blockerCodes must be an array.');

    void syncBlockerEvents(entityId, blockerCodes as string[]);
    void res.status(202).json({ ok: true, queued: true });
  }));

  // ── POST /api/seal/events/start-outcome ────────────────────────────────
  app.post('/api/seal/events/start-outcome', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);
    const {
      entityId, organizationContextId, startedAt,
      readinessScoreAtStart, blockersAtStart,
      sourceCoverageAtStart, metadata,
    } = req.body ?? {};

    if (!entityId || !UUID_RE.test(entityId)) throw new HttpError(400, 'entityId must be a valid UUID.');
    if (!startedAt || isNaN(Date.parse(startedAt))) throw new HttpError(400, 'startedAt must be a valid ISO date.');

    void captureStartOutcome({
      entityId,
      organizationContextId: organizationContextId ?? null,
      startedAt:             new Date(startedAt),
      readinessScoreAtStart: typeof readinessScoreAtStart === 'number' ? readinessScoreAtStart : null,
      blockersAtStart:       Array.isArray(blockersAtStart) ? blockersAtStart : [],
      sourceCoverageAtStart: sourceCoverageAtStart ?? {},
      metadata,
    });

    void res.status(202).json({ ok: true, queued: true });
  }));

  // ── GET /api/seal/training-set ─────────────────────────────────────────
  // Export training rows as newline-delimited JSON or JSON array.
  // Query: ?from=ISO&to=ISO&format=ndjson|json&limit=N
  // Feature-gated: only runs if SEAL_TRAINING_EXPORT_ENABLED=true
  app.get('/api/seal/training-set', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);

    if (process.env.SEAL_TRAINING_EXPORT_ENABLED !== 'true') {
      throw new HttpError(403, 'Training export is not enabled in this environment. Set SEAL_TRAINING_EXPORT_ENABLED=true.');
    }

    const fromStr = req.query.from as string | undefined;
    const toStr   = req.query.to   as string | undefined;
    const format  = (req.query.format as string | undefined) ?? 'json';

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 90 * 86_400_000);
    const to   = toStr   ? new Date(toStr)   : new Date();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new HttpError(400, 'from and to must be valid ISO dates.');
    }

    const snapshot = await buildTrainingSnapshot({ from, to });

    log('info', 'seal_training_export', {
      rowCount: snapshot.rowCount,
      fromDate: snapshot.fromDate,
      toDate:   snapshot.toDate,
    });

    if (format === 'ndjson') {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="seal-training-${snapshot.snapshotVersion}.ndjson"`,
      );
      // Write metadata line first
      res.write(JSON.stringify({
        _meta: true,
        snapshotVersion:   snapshot.snapshotVersion,
        generatedAt:       snapshot.generatedAt,
        rowCount:          snapshot.rowCount,
        safetyAttestation: snapshot.safetyAttestation,
      }) + '\n');
      for (const row of snapshot.rows) {
        res.write(JSON.stringify(row) + '\n');
      }
      res.end();
    } else {
      void res.json(snapshot);
    }
  }));

  // ── POST /api/seal/training-set/snapshot ──────────────────────────────
  // Create a named snapshot for the given date range and return it.
  app.post('/api/seal/training-set/snapshot', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);

    if (process.env.SEAL_TRAINING_EXPORT_ENABLED !== 'true') {
      throw new HttpError(403, 'Training export is not enabled in this environment.');
    }

    const { from: fromStr, to: toStr } = req.body ?? {};
    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86_400_000);
    const to   = toStr   ? new Date(toStr)   : new Date();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new HttpError(400, 'from and to must be valid ISO dates.');
    }

    const snapshot = await buildTrainingSnapshot({ from, to });

    log('info', 'seal_training_snapshot_created', {
      rowCount:        snapshot.rowCount,
      snapshotVersion: snapshot.snapshotVersion,
    });

    void res.status(201).json(snapshot);
  }));

  // ── GET /api/seal/health ───────────────────────────────────────────────
  app.get('/api/seal/health', asyncHandler(async (req, res): Promise<void> => {
    requireClerkUserId(req);
    const counts = await getSealEventCounts();
    void res.json({
      ok:     true,
      counts,
      safetyAttestation: 'SEAL event tables are behavioral/outcome signals only. Source truth is immutable.',
    });
  }));

  log('info', 'seal_training_routes_registered', {
    routes: [
      'POST /api/seal/events/advisory',
      'POST /api/seal/events/employer-decision',
      'POST /api/seal/events/blocker/open',
      'POST /api/seal/events/blocker/resolve',
      'POST /api/seal/events/blocker/sync',
      'POST /api/seal/events/start-outcome',
      'GET  /api/seal/training-set',
      'POST /api/seal/training-set/snapshot',
      'GET  /api/seal/health',
    ],
  });
}
