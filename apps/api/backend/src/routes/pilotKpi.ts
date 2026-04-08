/**
 * pilotKpi.ts — Pilot KPI API routes
 *
 * All routes are internal-only and require X-Monitoring-Secret.
 * Trust state is never mutated here.
 *
 * Routes:
 *   GET  /api/internal/pilot/kpis           — JSON KPI snapshot
 *   GET  /api/internal/pilot/kpis/export    — CSV export for pilot reporting
 *   POST /api/employer-review/:entityId/view — fire EMPLOYER_REVIEW advisory event
 *   POST /api/internal/pilot/start-outcome  — manual start outcome recording
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  computePilotKpis,
  kpiSnapshotToCsv,
  type PilotFilter,
} from '../services/pilot/pilotKpiService';
import { generateRoiReport, roiReportToHtml } from '../services/pilot/roiReportService';
import {
  captureAdvisoryEvent,
  captureStartOutcome,
  recordPilotProofEvent,
  type StartOutcomeStatus,
} from '../services/seal/sealEventCapture';
import { parseScopeFromQuery } from '../services/seal/pilotScope';
import { resolveEmployerReviewAttribution } from '../services/entity/employerReviewAttribution';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requireMonitoringSecret(req: Request, res: Response): boolean {
  const secret = process.env.MONITORING_SECRET?.trim() ?? '';
  const provided = (
    req.headers['x-monitoring-secret']
    ?? req.query['secret']
  ) as string | undefined;

  if (!secret || !provided || provided.trim() !== secret) {
    res.status(403).json({ error: 'Forbidden — X-Monitoring-Secret required.' });
    return false;
  }

  return true;
}

function readWindowDays(value: unknown): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? parsed : 90;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readPilotFilter(source: Record<string, unknown>): PilotFilter {
  const scope = parseScopeFromQuery(source);

  return {
    ...scope,
    orgContextId:
      readOptionalString(source.organizationContextId)
      ?? readOptionalString(source.orgContextId)
      ?? readOptionalString(source.org),
  };
}

export function registerPilotKpiRoutes(app: Express): void {
  app.get('/api/internal/pilot/kpis', asyncHandler(async (req, res): Promise<void> => {
    if (!requireMonitoringSecret(req, res)) return;

    const windowDays = readWindowDays(req.query.days);
    const filter = readPilotFilter(req.query as Record<string, unknown>);
    const snapshot = await computePilotKpis({ windowDays, filter });

    void res.json(snapshot);
  }));

  // ── GET /api/internal/pilot/roi-report ─────────────────────────────────────
  // ROI executive report — JSON. Buyer-readable with baselines + deltas.
  app.get('/api/internal/pilot/roi-report', asyncHandler(async (req, res): Promise<void> => {
    if (!requireMonitoringSecret(req, res)) return;

    const windowDays = readWindowDays(req.query.days);
    const filter = readPilotFilter(req.query as Record<string, unknown>);
    const snapshot = await computePilotKpis({ windowDays, filter });
    const report = generateRoiReport(snapshot);

    void res.json(report);
  }));

  // ── GET /api/internal/pilot/roi-report/html ─────────────────────────────────
  // ROI executive report — self-contained print-ready HTML. Buyer handout.
  app.get('/api/internal/pilot/roi-report/html', asyncHandler(async (req, res): Promise<void> => {
    if (!requireMonitoringSecret(req, res)) return;

    const windowDays = readWindowDays(req.query.days);
    const filter = readPilotFilter(req.query as Record<string, unknown>);
    const snapshot = await computePilotKpis({ windowDays, filter });
    const report = generateRoiReport(snapshot);
    const html = roiReportToHtml(report);

    const filename = `vitalcv-roi-report-${new Date().toISOString().slice(0, 10)}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    void res.send(html);
  }));

  app.get('/api/internal/pilot/kpis/export', asyncHandler(async (req, res): Promise<void> => {
    if (!requireMonitoringSecret(req, res)) return;

    const windowDays = readWindowDays(req.query.days);
    const filter = readPilotFilter(req.query as Record<string, unknown>);
    const snapshot = await computePilotKpis({ windowDays, filter });
    const csv = kpiSnapshotToCsv(snapshot);

    const filename = `vitalcv-pilot-kpis-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    void res.send(csv);
  }));

  app.post('/api/employer-review/:entityId/view', asyncHandler(async (req, res): Promise<void> => {
    const { entityId } = req.params as { entityId: string };

    if (!UUID_RE.test(entityId)) {
      void res.status(400).json({ error: 'entityId must be a valid UUID.' });
      return;
    }

    const {
      organizationContextId,
      bundleId,
      readinessScore,
      blockers,
      sharedBy,
    } = req.body ?? {};
    const attribution = await resolveEmployerReviewAttribution({
      entityId,
      organizationContextId,
      bundleId,
    });
    const resolvedOrganizationContextId =
      attribution.organizationContextId
      ?? readOptionalString(organizationContextId);
    const scope = readPilotFilter({
      ...((req.body ?? {}) as Record<string, unknown>),
      organizationContextId: resolvedOrganizationContextId,
    });

    void captureAdvisoryEvent({
      entityId,
      organizationContextId: resolvedOrganizationContextId,
      advisoryVersion: 'pilot-review-open',
      eventType: 'EMPLOYER_REVIEW',
      blockersAtEvent: Array.isArray(blockers) ? blockers as string[] : [],
      readinessScoreAtEvent: typeof readinessScore === 'number' ? readinessScore : null,
      sourceCoverageAtEvent: { live: ['NPPES', 'OIG / LEIE'], gated: [], mock: ['CMS PECOS'], notChecked: [] },
      metadata: {
        eventName: 'employer_review_opened',
        source: attribution.source,
        bundleId: attribution.bundleId,
        bundleShareEventId: attribution.bundleShareEventId,
        requestorEntityId: attribution.requestorEntityId,
        organizationId: attribution.organizationId,
        organizationName: attribution.organizationName,
        purposeOfUse: attribution.purposeOfUse,
        sharedBy: sharedBy ?? null,
        reviewerClerkId: req.headers['x-clerk-user-id'] ?? null,
      },
      scope,
    }).catch((err) => {
      log('warn', 'pilot_review_view_capture_failed', { entityId, error: String(err) });
    });

    void res.status(202).json({ ok: true, queued: true });
  }));

  app.post('/api/internal/pilot/start-outcome', asyncHandler(async (req, res): Promise<void> => {
    if (!requireMonitoringSecret(req, res)) return;

    const {
      entityId,
      status,
      startedAt,
      actualStartDate,
      recordedAt,
      organizationContextId,
      readinessScoreAtStart,
      blockers,
      nonStartReason,
      nonStartCategory,
      reason,
      blockerNotes,
      note,
    } = req.body ?? {};

    // Accept: STARTED, started, NOT_STARTED, not_started, DID_NOT_START
    const rawStatus = readOptionalString(status)?.toUpperCase() ?? 'STARTED';
    const normalizedStatus: 'STARTED' | 'NOT_STARTED' =
      rawStatus === 'DID_NOT_START' || rawStatus === 'NOT_STARTED'
        ? 'NOT_STARTED'
        : 'STARTED';

    if (!entityId || !UUID_RE.test(entityId)) {
      void res.status(400).json({ error: 'entityId must be a valid UUID.' });
      return;
    }

    if (rawStatus !== 'STARTED' && rawStatus !== 'DID_NOT_START' && rawStatus !== 'NOT_STARTED') {
      void res.status(400).json({ error: 'status must be STARTED, NOT_STARTED, or DID_NOT_START.' });
      return;
    }

    const effectiveStartDate = readOptionalString(actualStartDate) ?? readOptionalString(startedAt);
    if (normalizedStatus === 'STARTED' && (!effectiveStartDate || isNaN(Date.parse(effectiveStartDate)))) {
      void res.status(400).json({ error: 'startedAt or actualStartDate must be a valid ISO date string.' });
      return;
    }

    if (normalizedStatus === 'NOT_STARTED' && recordedAt && isNaN(Date.parse(recordedAt as string))) {
      void res.status(400).json({ error: 'recordedAt must be a valid ISO date string.' });
      return;
    }

    const scope = readPilotFilter((req.body ?? {}) as Record<string, unknown>);
    const resolvedOrganizationContextId = readOptionalString(organizationContextId);
    const effectiveReason = readOptionalString(reason) ?? readOptionalString(nonStartReason);
    const effectiveBlockerNotes = readOptionalString(blockerNotes) ?? (typeof note === 'string' ? note : null);

    if (normalizedStatus === 'NOT_STARTED') {
      const effectiveRecordedAt =
        readOptionalString(recordedAt)
        ?? new Date().toISOString();

      void recordPilotProofEvent({
        eventName: 'start_outcome_recorded',
        entityId,
        organizationContextId: resolvedOrganizationContextId,
        occurredAt: effectiveRecordedAt,
        metadata: {
          outcomeStatus: 'NOT_STARTED',
          nonStartReason: effectiveReason,
          nonStartCategory: readOptionalString(nonStartCategory),
          reason: effectiveReason,
          blockerNotes: effectiveBlockerNotes,
          pilotId: scope.pilotId ?? null,
          workflowLane: scope.workflowLane ?? null,
          geographyTag: scope.geographyTag ?? null,
        },
      });

      log('info', 'pilot_non_start_outcome_recorded_manually', {
        entityId,
        reason: effectiveReason,
        recordedAt: effectiveRecordedAt,
      });
      void res.status(202).json({
        ok: true,
        queued: true,
        entityId,
        status: 'NOT_STARTED',
        reason: effectiveReason,
        blockerNotes: effectiveBlockerNotes,
        recordedAt: effectiveRecordedAt,
      });
      return;
    }

    void captureStartOutcome({
      entityId,
      organizationContextId: resolvedOrganizationContextId,
      outcomeStatus: 'STARTED' as StartOutcomeStatus,
      startedAt: new Date(effectiveStartDate!),
      actualStartDate: effectiveStartDate ? new Date(effectiveStartDate) : null,
      readinessScoreAtStart: typeof readinessScoreAtStart === 'number' ? readinessScoreAtStart : null,
      blockersAtStart: Array.isArray(blockers) ? blockers as string[] : [],
      sourceCoverageAtStart: {},
      reason: effectiveReason,
      blockerNotes: effectiveBlockerNotes,
      metadata: {
        recordedBy: 'operator-manual',
        monitoredAt: new Date().toISOString(),
      },
      scope,
    });

    log('info', 'pilot_start_outcome_recorded_manually', { entityId, startedAt: effectiveStartDate });
    void res.status(202).json({
      ok: true,
      queued: true,
      entityId,
      status: 'STARTED',
      actualStartDate: effectiveStartDate,
    });
  }));

  log('info', 'pilot_kpi_routes_registered', {
    routes: [
      'GET  /api/internal/pilot/kpis',
      'GET  /api/internal/pilot/kpis/export',
      'GET  /api/internal/pilot/roi-report',
      'GET  /api/internal/pilot/roi-report/html',
      'POST /api/employer-review/:entityId/view',
      'POST /api/internal/pilot/start-outcome',
    ],
  });
}
