/**
 * pilotKpi.ts — Pilot KPI API routes
 *
 * All routes are internal-only and require X-Monitoring-Secret.
 * Trust state is never mutated here.
 *
 * Routes:
 *   GET  /api/internal/pilot/kpis          — JSON KPI snapshot
 *   GET  /api/internal/pilot/kpis/export   — CSV export for pilot reporting
 *   POST /api/employer-review/:entityId/view — fire EMPLOYER_REVIEW advisory event
 *   POST /api/internal/pilot/start-outcome  — manual start outcome recording
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { computePilotKpis, kpiSnapshotToCsv } from '../services/pilot/pilotKpiService';
import { captureAdvisoryEvent, captureStartOutcome } from '../services/seal/sealEventCapture';
import { log } from '../obs/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requireMonitoringSecret(req: Request, res: Response): boolean {
  const secret = process.env.MONITORING_SECRET?.trim() ?? '';
  const provided = (
    req.headers['x-monitoring-secret'] ??
    req.query['secret']
  ) as string | undefined;
  if (!secret || !provided || provided.trim() !== secret) {
    res.status(403).json({ error: 'Forbidden — X-Monitoring-Secret required.' });
    return false;
  }
  return true;
}

function readWindowDays(value: unknown): number {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 && n <= 365 ? n : 90;
}

export function registerPilotKpiRoutes(app: Express): void {

  // ── GET /api/internal/pilot/kpis ──────────────────────────────────────
  // JSON snapshot of all 7 pilot KPIs. Monitoring-secret gated.
  app.get('/api/internal/pilot/kpis', asyncHandler(async (req, res): Promise<void> => {
    if (!requireMonitoringSecret(req, res)) return;

    const windowDays = readWindowDays(req.query.days);
    const snapshot   = await computePilotKpis({ windowDays });

    void res.json(snapshot);
  }));

  // ── GET /api/internal/pilot/kpis/export ───────────────────────────────
  // CSV export for copy-paste into pilot reporting spreadsheet.
  app.get('/api/internal/pilot/kpis/export', asyncHandler(async (req, res): Promise<void> => {
    if (!requireMonitoringSecret(req, res)) return;

    const windowDays = readWindowDays(req.query.days);
    const snapshot   = await computePilotKpis({ windowDays });
    const csv        = kpiSnapshotToCsv(snapshot);

    const filename = `vitalcv-pilot-kpis-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    void res.send(csv);
  }));

  // ── POST /api/employer-review/:entityId/view ──────────────────────────
  // Fire-and-forget: called when an employer opens /review/[entityId].
  // This populates advisory_outcome_events with eventType='EMPLOYER_REVIEW',
  // enabling the velocity KPI calculations.
  //
  // Body (all optional):
  //   organizationContextId — string UUID
  //   readinessScore        — number
  //   blockers              — string[]
  //   sharedBy              — string (the clinician's clerk user or NPI)
  //
  // Auth: x-clerk-user-id (employer's clerk ID or system placeholder)
  // Non-blocking: always returns 202.
  app.post('/api/employer-review/:entityId/view', asyncHandler(async (req, res): Promise<void> => {
    const { entityId } = req.params as { entityId: string };

    if (!UUID_RE.test(entityId)) {
      void res.status(400).json({ error: 'entityId must be a valid UUID.' });
      return;
    }

    const { organizationContextId, readinessScore, blockers, sharedBy } = req.body ?? {};

    // Fire-and-forget — never block the review page render on this
    void captureAdvisoryEvent({
      entityId,
      organizationContextId: typeof organizationContextId === 'string' ? organizationContextId : null,
      advisoryVersion:       'pilot-review-open',
      eventType:             'EMPLOYER_REVIEW',
      blockersAtEvent:       Array.isArray(blockers) ? blockers as string[] : [],
      readinessScoreAtEvent: typeof readinessScore === 'number' ? readinessScore : null,
      sourceCoverageAtEvent: { live: ['NPPES', 'OIG / LEIE'], gated: [], mock: ['CMS PECOS'], notChecked: [] },
      metadata:              { sharedBy: sharedBy ?? null, reviewerClerkId: req.headers['x-clerk-user-id'] ?? null },
    }).catch((err) => {
      log('warn', 'pilot_review_view_capture_failed', { entityId, error: String(err) });
    });

    void res.status(202).json({ ok: true, queued: true });
  }));

  // ── POST /api/internal/pilot/start-outcome ────────────────────────────
  // Manual start outcome recording for pilots that need an operator to confirm a start.
  // Used when the hire happened outside the StartAttestation flow.
  // Monitoring-secret gated.
  //
  // Body:
  //   entityId              — UUID (required)
  //   startedAt             — ISO date (required)
  //   organizationContextId — UUID (optional)
  //   readinessScoreAtStart — number (optional)
  //   blockers              — string[] (optional)
  //   note                  — string (optional, goes to metadata)
  app.post('/api/internal/pilot/start-outcome', asyncHandler(async (req, res): Promise<void> => {
    if (!requireMonitoringSecret(req, res)) return;

    const { entityId, startedAt, organizationContextId, readinessScoreAtStart, blockers, note } = req.body ?? {};

    if (!entityId || !UUID_RE.test(entityId)) {
      void res.status(400).json({ error: 'entityId must be a valid UUID.' });
      return;
    }
    if (!startedAt || isNaN(Date.parse(startedAt as string))) {
      void res.status(400).json({ error: 'startedAt must be a valid ISO date string.' });
      return;
    }

    void captureStartOutcome({
      entityId,
      organizationContextId: typeof organizationContextId === 'string' ? organizationContextId : null,
      startedAt:             new Date(startedAt as string),
      readinessScoreAtStart: typeof readinessScoreAtStart === 'number' ? readinessScoreAtStart : null,
      blockersAtStart:       Array.isArray(blockers) ? blockers as string[] : [],
      sourceCoverageAtStart: {},
      metadata:              {
        recordedBy:  'operator-manual',
        note:        typeof note === 'string' ? note : null,
        monitoredAt: new Date().toISOString(),
      },
    });

    log('info', 'pilot_start_outcome_recorded_manually', { entityId, startedAt });
    void res.status(202).json({ ok: true, queued: true, entityId, startedAt });
  }));

  log('info', 'pilot_kpi_routes_registered', {
    routes: [
      'GET  /api/internal/pilot/kpis',
      'GET  /api/internal/pilot/kpis/export',
      'POST /api/employer-review/:entityId/view',
      'POST /api/internal/pilot/start-outcome',
    ],
  });
}
