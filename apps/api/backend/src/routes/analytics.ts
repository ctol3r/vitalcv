/**
 * analytics.ts — Wave 116: Analytics Routes
 *
 * GET /api/analytics/overview     — Platform KPI overview
 * GET /api/analytics/credentials  — Credential issuance stats
 * GET /api/analytics/verifiers    — Verifier activity
 * GET /api/analytics/network      — Network growth
 * GET /api/analytics/revenue      — Revenue & API usage
 */

import type { Express, Request, Response } from 'express';
import {
  getPlatformOverview,
  getCredentialIssuanceStats,
  getVerifierActivity,
  getNetworkGrowth,
  getTopIssuers,
  getApiUsageSummary,
  getRevocationRate,
} from '../services/analytics/analyticsEngine';
import { requireInternalSecret } from '../middleware/internalSecret';
import { log } from '../obs/logger';

export function registerAnalyticsRoutes(app: Express): void {

  app.get('/api/analytics/overview', requireInternalSecret, async (_req: Request, res: Response) => {
    try {
      const overview = await getPlatformOverview();
      res.json(overview);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'analytics_overview_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/analytics/credentials', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      const days = Number(req.query.days) || 30;
      const stats = await getCredentialIssuanceStats(days);
      res.json(stats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/analytics/verifiers', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      const days = Number(req.query.days) || 30;
      const activity = await getVerifierActivity(days);
      res.json(activity);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/analytics/network', requireInternalSecret, async (_req: Request, res: Response) => {
    try {
      const [network, topIssuers] = await Promise.all([
        getNetworkGrowth(),
        getTopIssuers(10),
      ]);
      res.json({ ...network, topIssuers });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/analytics/revenue', requireInternalSecret, async (_req: Request, res: Response) => {
    try {
      const [apiUsage, revocation] = await Promise.all([
        getApiUsageSummary(),
        getRevocationRate(),
      ]);
      res.json({ ...apiUsage, revocationRate: revocation.rate });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });
}
