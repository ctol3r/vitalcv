/**
 * asyncTrust.ts — Wave 245: Async Trust Engine Routes
 *
 * Routes:
 *   POST /api/trust/events          — ingest a credential event
 *   POST /api/trust/events/batch    — ingest batch events
 *   GET  /api/trust/monitoring/status — monitoring status
 *   POST /api/trust/monitoring/cycle  — trigger monitoring cycle (admin)
 */

import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { processCredentialEvent, processEventBatch } from '../services/async/asyncTrustEngine';
import {
  enqueueEvent,
  drainEvents,
  getQueueDepth,
  type CredentialEvent,
  type CredentialEventType,
} from '../services/async/eventQueue';
import {
  getLastCycleReport,
  getLastCycleTime,
  isSchedulerRunning,
  isCycleInProgress,
  triggerMonitoringCycle,
} from '../services/async/monitoringScheduler';
import { log } from '../obs/logger';
import prisma from '../graphql/prisma_client';
import { requireInternalSecret } from '../middleware/internalSecret';

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_EVENT_TYPES: CredentialEventType[] = [
  'LICENSE_UPDATED',
  'LICENSE_EXPIRED',
  'SANCTION_DETECTED',
  'BOARD_EXPIRED',
  'DEA_UPDATED',
  'CREDENTIAL_VERIFIED',
  'CREDENTIAL_REVOKED',
  'MONITORING_ALERT',
];

function isValidEventType(t: unknown): t is CredentialEventType {
  return typeof t === 'string' && VALID_EVENT_TYPES.includes(t as CredentialEventType);
}

function isValidNpi(npi: unknown): boolean {
  return typeof npi === 'string' && /^\d{10}$/.test(npi);
}

// ── Monitored NPI count ───────────────────────────────────────────────────────

async function getMonitoredNpiCount(): Promise<number> {
  try {
    const result = await prisma.verificationArtifact.findMany({
      where: {
        OR: [
          { monitoring: true },
          { source: { not: 'TRUST_STATE_ENGINE' }, status: { in: ['ACTIVE', 'VERIFIED'] } },
        ],
      },
      select: { npi: true },
      distinct: ['npi'],
    });
    return result.length;
  } catch {
    return 0;
  }
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * AUTHORIZATION (2026-08-08). `POST /api/trust/events/batch` and
 * `POST /api/trust/monitoring/cycle` had no authorization beyond the global
 * tenant guard — anonymous batch trust-event injection and monitoring-cycle
 * triggering with one header. Operator secret; neither has a caller (the web
 * proxy at `app/api/trust/events` forwards only to /api/trust/events, and
 * `MonitoringStatusPanel` is imported by no page).
 *
 * `POST /api/trust/events` is now guarded too. Its web proxy
 * (`app/api/trust/events`) has no auth of its own and no UI caller, so the
 * proxy fronts nothing and will simply 403 — forwarding the secret from an
 * unauthenticated proxy would have laundered it to anonymous callers.
 */
export function registerAsyncTrustRoutes(app: Express): void {

  /**
   * POST /api/trust/events
   * Ingest a single credential event and process it immediately.
   * Requires x-clerk-user-id header.
   */
  app.post('/api/trust/events', requireInternalSecret, async (req: Request, res: Response) => {
    const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized — x-clerk-user-id required' });
      return;
    }

    const { npi, type, source, payload } = req.body as {
      npi?: unknown;
      type?: unknown;
      source?: string;
      payload?: Record<string, unknown>;
    };

    if (!isValidNpi(npi)) {
      res.status(400).json({ error: 'Invalid or missing npi (must be 10-digit string)' });
      return;
    }
    if (!isValidEventType(type)) {
      res.status(400).json({
        error: `Invalid or missing event type. Valid types: ${VALID_EVENT_TYPES.join(', ')}`,
      });
      return;
    }

    const event: CredentialEvent = {
      eventId: randomUUID(),
      npi: npi as string,
      type,
      occurredAt: new Date().toISOString(),
      source: source ?? 'api',
      payload,
    };

    // Enqueue for async processing (fire-and-forget pattern) AND process immediately
    enqueueEvent(event);

    try {
      const change = await processCredentialEvent(event);
      log('info', 'async_trust_routes: event_ingested', {
        eventId: event.eventId,
        npi: event.npi,
        type,
        degraded: change.degraded,
        clerkUserId,
      });
      res.status(200).json({ ok: true, eventId: event.eventId, change });
    } catch (err) {
      log('error', 'async_trust_routes: event_process_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to process event', eventId: event.eventId });
    }
  });

  /**
   * POST /api/trust/events/batch
   * Ingest and process multiple credential events (deduped by NPI).
   */
  app.post('/api/trust/events/batch', requireInternalSecret, async (req: Request, res: Response) => {
    const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized — x-clerk-user-id required' });
      return;
    }

    const body = req.body as { events?: unknown[] };
    if (!Array.isArray(body.events) || body.events.length === 0) {
      res.status(400).json({ error: 'events array required and must be non-empty' });
      return;
    }

    if (body.events.length > 500) {
      res.status(400).json({ error: 'Batch size exceeds maximum of 500 events' });
      return;
    }

    const events: CredentialEvent[] = [];
    const errors: string[] = [];

    for (let i = 0; i < body.events.length; i++) {
      const raw = body.events[i] as Record<string, unknown>;
      if (!isValidNpi(raw.npi)) {
        errors.push(`Event[${i}]: invalid npi`);
        continue;
      }
      if (!isValidEventType(raw.type)) {
        errors.push(`Event[${i}]: invalid type`);
        continue;
      }
      events.push({
        eventId: randomUUID(),
        npi: raw.npi as string,
        type: raw.type as CredentialEventType,
        occurredAt: new Date().toISOString(),
        source: (raw.source as string | undefined) ?? 'api-batch',
        payload: raw.payload as Record<string, unknown> | undefined,
      });
    }

    // Enqueue all valid events
    for (const ev of events) {
      enqueueEvent(ev);
    }

    try {
      const changes = await processEventBatch(events);
      log('info', 'async_trust_routes: batch_processed', {
        total: body.events.length,
        processed: changes.length,
        errors: errors.length,
        clerkUserId,
      });
      res.status(200).json({
        ok: true,
        processed: changes.length,
        errors,
        changes,
      });
    } catch (err) {
      log('error', 'async_trust_routes: batch_error', { error: String(err) });
      res.status(500).json({ error: 'Batch processing failed' });
    }
  });

  /**
   * GET /api/trust/monitoring/status
   * Returns current monitoring status: queue depth, last cycle, NPIs monitored.
   */
  app.get('/api/trust/monitoring/status', async (_req: Request, res: Response) => {
    try {
      const [monitoredNpis, queueDepth] = await Promise.all([
        getMonitoredNpiCount(),
        Promise.resolve(getQueueDepth()),
      ]);

      const lastReport = getLastCycleReport();
      const lastCycleTime = getLastCycleTime();

      res.status(200).json({
        ok: true,
        scheduler: {
          running: isSchedulerRunning(),
          cycleInProgress: isCycleInProgress(),
          lastCycleTime: lastCycleTime?.toISOString() ?? null,
        },
        queue: {
          depth: queueDepth,
        },
        monitoring: {
          npisMonitored: monitoredNpis,
        },
        lastCycle: lastReport
          ? {
              npisScanned: lastReport.npisScanned,
              stateChanges: lastReport.stateChanges.length,
              alerts: lastReport.alerts,
              capsulesAffected: lastReport.capsulesAffected,
              startedAt: lastReport.startedAt,
              completedAt: lastReport.completedAt,
              durationMs: lastReport.durationMs,
              recentDegradations: lastReport.stateChanges
                .filter((c) => c.degraded)
                .slice(0, 10)
                .map((c) => ({
                  npi: c.npi,
                  previousBand: c.previousBand,
                  newBand: c.newBand,
                  capsulesAffected: c.affectedCapsules.length,
                  processedAt: c.processedAt,
                })),
            }
          : null,
      });
    } catch (err) {
      log('error', 'async_trust_routes: status_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to fetch monitoring status' });
    }
  });

  /**
   * POST /api/trust/monitoring/cycle
   * Manually trigger a monitoring cycle (admin).
   */
  app.post('/api/trust/monitoring/cycle', requireInternalSecret, async (req: Request, res: Response) => {
    const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
    if (!clerkUserId) {
      res.status(401).json({ error: 'Unauthorized — x-clerk-user-id required' });
      return;
    }

    if (isCycleInProgress()) {
      res.status(409).json({ error: 'A monitoring cycle is already in progress' });
      return;
    }

    try {
      log('info', 'async_trust_routes: manual_cycle_triggered', { clerkUserId });
      const report = await triggerMonitoringCycle();
      res.status(200).json({ ok: true, report });
    } catch (err) {
      log('error', 'async_trust_routes: manual_cycle_error', { error: String(err) });
      res.status(500).json({ error: 'Monitoring cycle failed' });
    }
  });

  log('info', 'async_trust_routes: registered');
}
