/**
 * Wave 194 — Marketplace Analytics Routes
 *
 * POST /api/analytics/event            — Emit a tracked event
 * GET  /api/analytics/funnel           — Full funnel report
 * GET  /api/analytics/search           — Search-specific analytics
 * GET  /api/analytics/marketplace      — Combined operator dashboard
 */

import type { Express, Request, Response } from 'express';
import { emit, getFunnelReport, getSearchAnalytics } from '../services/analytics/marketplaceAnalytics';
import type { AnalyticsEventName } from '../services/analytics/marketplaceAnalytics';

export function registerMarketplaceAnalyticsRoutes(app: Express): void {

  /** POST /api/analytics/event — { name, npi?, properties? } */
  app.post('/api/analytics/event', (req: Request, res: Response) => {
    const { name, npi, properties = {} } = req.body ?? {};
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    emit(name as AnalyticsEventName, { npi, ...properties });
    res.json({ success: true });
  });

  /** GET /api/analytics/funnel */
  app.get('/api/analytics/funnel', (_req: Request, res: Response) => {
    res.json(getFunnelReport());
  });

  /** GET /api/analytics/search */
  app.get('/api/analytics/search', (_req: Request, res: Response) => {
    res.json(getSearchAnalytics());
  });

  /** GET /api/analytics/marketplace — combined snapshot */
  app.get('/api/analytics/marketplace', (_req: Request, res: Response) => {
    res.json({
      funnel: getFunnelReport(),
      search: getSearchAnalytics(),
    });
  });
}
