/**
 * networkTelemetry.ts — Wave 150: Network Telemetry Intelligence API Routes
 *
 * GET /api/network/telemetry/dashboard  — Full telemetry dashboard
 * GET /api/network/growth               — Network growth data
 * GET /api/network/activity             — Activity feed
 * GET /api/network/throughput           — Verification throughput
 * GET /api/network/issuers/activity     — Per-issuer activity breakdown
 */

import type { Express, Request, Response } from 'express';
import {
  getNetworkTelemetryDashboard,
  getNetworkGrowth,
  getNetworkActivityFeed,
  getVerificationThroughput,
  getIssuerActivitySummary,
} from '../services/network/networkTelemetry';
import { log } from '../obs/logger';

export function registerNetworkTelemetryRoutes(app: Express): void {
  app.get('/api/network/telemetry/dashboard', async (_req: Request, res: Response) => {
    try {
      const dashboard = await getNetworkTelemetryDashboard();
      res.json(dashboard);
    } catch (err) {
      log('error', 'network_telemetry_dashboard_error', { error: String(err) });
      res.status(500).json({ error: 'Telemetry dashboard failed' });
    }
  });

  app.get('/api/network/growth', async (req: Request, res: Response) => {
    try {
      const days = Math.max(7, Math.min(90, Number(req.query.days) || 30));
      const growth = await getNetworkGrowth(days);
      res.json(growth);
    } catch (err) {
      log('error', 'network_growth_error', { error: String(err) });
      res.status(500).json({ error: 'Growth data failed' });
    }
  });

  app.get('/api/network/activity', async (req: Request, res: Response) => {
    try {
      const limit = Math.max(10, Math.min(200, Number(req.query.limit) || 50));
      const feed = await getNetworkActivityFeed(limit);
      res.json(feed);
    } catch (err) {
      log('error', 'network_activity_error', { error: String(err) });
      res.status(500).json({ error: 'Activity feed failed' });
    }
  });

  app.get('/api/network/throughput', async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(30, Number(req.query.days) || 7));
      const throughput = await getVerificationThroughput(days);
      res.json(throughput);
    } catch (err) {
      log('error', 'network_throughput_error', { error: String(err) });
      res.status(500).json({ error: 'Throughput data failed' });
    }
  });

  app.get('/api/network/issuers/activity', async (_req: Request, res: Response) => {
    try {
      const activity = await getIssuerActivitySummary();
      res.json(activity);
    } catch (err) {
      log('error', 'issuer_activity_error', { error: String(err) });
      res.status(500).json({ error: 'Issuer activity failed' });
    }
  });
}
