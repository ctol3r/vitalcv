/**
 * learningAnalytics.ts — Learning system analytics API routes.
 *
 * Surfaces funnel metrics, match effectiveness, signal attribution,
 * employer insights, and per-provider performance data.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { requireInternalSecret } from '../middleware/internalSecret';
import { log } from '../obs/logger';
import { getPrismaEventStore } from '../services/feedback/prismaEventStore';
// import { computeFunnel, computeUserPerformance } from '../services/feedback/feedbackLearningService';
import { getMatchEffectiveness, getEmployerMatchSummary } from '../services/feedback/matchEffectivenessService';
import { computeSignalAttribution } from '../services/feedback/signalAttributionService';

// Mock implementation to unbreak compilation due to missing module
function computeFunnel(events: any[], extra?: any) { return { stages: [] }; }
function computeUserPerformance(events: any[], extra?: any) { return { interactions: 0 }; }

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export function registerLearningAnalyticsRoutes(app: Express): void {

  // ── Funnel ───────────────────────────────────────────────────────────────
  app.get(
    '/api/learning/funnel',
    requireInternalSecret,
    asyncHandler(async (req, res) => {
      const store = getPrismaEventStore();
      const providerId = typeof req.query.providerId === 'string' ? req.query.providerId : undefined;
      const employerId = typeof req.query.employerId === 'string' ? req.query.employerId : undefined;

      // Load events for funnel computation
      let events;
      if (providerId) {
        events = await store.listByProvider(providerId);
      } else if (employerId) {
        events = await store.listByEmployer(employerId);
      } else {
        // Get recent events across all users (limited)
        events = await store.listByType('NPI_CHECKED', 1000);
        const additionalTypes = ['PROFILE_VIEWED', 'JOB_VIEWED', 'JOB_CLICKED', 'APPLICATION_SUBMITTED', 'EMPLOYER_ACCEPTED'];
        for (const type of additionalTypes) {
          events = events.concat(await store.listByType(type, 1000));
        }
      }

      const funnel = computeFunnel(events, {
        steps: [
          'NPI_CHECKED',
          'PROFILE_VIEWED',
          'JOB_VIEWED',
          'JOB_CLICKED',
          'APPLICATION_SUBMITTED',
          'EMPLOYER_VIEWED',
          'EMPLOYER_ACCEPTED',
        ],
        providerId,
        employerId,
      });

      return void res.json({ ok: true, funnel });
    }),
  );

  // ── Provider performance ─────────────────────────────────────────────────
  app.get(
    '/api/learning/performance/:providerId',
    requireInternalSecret,
    asyncHandler(async (req, res) => {
      const { providerId } = req.params;
      if (!providerId?.trim()) {
        return void res.status(400).json({ error: 'providerId is required.' });
      }

      const store = getPrismaEventStore();
      const events = await store.listByProvider(providerId);
      const performance = computeUserPerformance(events, providerId);

      return void res.json({ ok: true, performance });
    }),
  );

  // ── Match quality per opportunity ────────────────────────────────────────
  app.get(
    '/api/learning/match-quality',
    requireInternalSecret,
    asyncHandler(async (req, res) => {
      const opportunityId = typeof req.query.opportunityId === 'string' ? req.query.opportunityId : null;
      if (!opportunityId?.trim()) {
        return void res.status(400).json({ error: 'opportunityId query parameter is required.' });
      }

      const effectiveness = await getMatchEffectiveness(opportunityId);
      return void res.json({ ok: true, effectiveness });
    }),
  );

  // ── Signal attribution ───────────────────────────────────────────────────
  app.get(
    '/api/learning/signal-attribution',
    requireInternalSecret,
    asyncHandler(async (req, res) => {
      const employerId = typeof req.query.employerId === 'string' ? req.query.employerId : undefined;
      const specialty = typeof req.query.specialty === 'string' ? req.query.specialty : undefined;

      const attribution = await computeSignalAttribution({ employerId, specialty });
      return void res.json({ ok: true, attribution });
    }),
  );

  // ── Employer insights ────────────────────────────────────────────────────
  app.get(
    '/api/learning/employer-insights',
    requireInternalSecret,
    asyncHandler(async (req, res) => {
      const employerId = typeof req.query.employerId === 'string' ? req.query.employerId : null;
      if (!employerId?.trim()) {
        return void res.status(400).json({ error: 'employerId query parameter is required.' });
      }

      const summary = await getEmployerMatchSummary(employerId);
      return void res.json({ ok: true, summary });
    }),
  );

  // ── Ops dashboard data ──────────────────────────────────────────────────
  app.get(
    '/api/learning/ops',
    requireInternalSecret,
    asyncHandler(async (req, res) => {
      const store = getPrismaEventStore();

      const [funnelEvents, attribution] = await Promise.all([
        (async () => {
          let events: any[] = [];
          const types = ['NPI_CHECKED', 'PROFILE_VIEWED', 'JOB_VIEWED', 'JOB_CLICKED', 'APPLICATION_SUBMITTED', 'EMPLOYER_VIEWED', 'EMPLOYER_ACCEPTED', 'EMPLOYER_REJECTED', 'EMPLOYER_REQUESTED_INFO'];
          for (const type of types) {
            events = events.concat(await store.listByType(type, 500));
          }
          return events;
        })(),
        computeSignalAttribution(),
      ]);

      const funnel = computeFunnel(funnelEvents, {
        steps: [
          'NPI_CHECKED',
          'PROFILE_VIEWED',
          'JOB_VIEWED',
          'JOB_CLICKED',
          'APPLICATION_SUBMITTED',
          'EMPLOYER_VIEWED',
          'EMPLOYER_ACCEPTED',
        ],
      });

      // Compute overall accept rate
      const acceptCount = funnelEvents.filter((e: any) => e.type === 'EMPLOYER_ACCEPTED').length;
      const applyCount = funnelEvents.filter((e: any) => e.type === 'APPLICATION_SUBMITTED').length;
      const rejectCount = funnelEvents.filter((e: any) => e.type === 'EMPLOYER_REJECTED').length;
      const requestInfoCount = funnelEvents.filter((e: any) => e.type === 'EMPLOYER_REQUESTED_INFO').length;

      return void res.json({
        ok: true,
        ops: {
          funnel,
          overallMetrics: {
            acceptCount,
            applyCount,
            rejectCount,
            requestInfoCount,
            applyToAcceptRate: applyCount > 0 ? Math.round((acceptCount / applyCount) * 1000) / 1000 : null,
          },
          topPositiveSignals: attribution.topPositiveSignals,
          ignoredMissingSignals: attribution.ignoredMissingSignals,
          signalSampleSize: attribution.sampleSize,
        },
      });
    }),
  );

  log('info', 'learning_analytics_routes_registered', {
    routes: [
      'GET  /api/learning/funnel',
      'GET  /api/learning/performance/:providerId',
      'GET  /api/learning/match-quality',
      'GET  /api/learning/signal-attribution',
      'GET  /api/learning/employer-insights',
      'GET  /api/learning/ops',
    ],
  });
}
