/**
 * networkAnalytics.ts — Wave 140: Network Telemetry Intelligence API Routes
 *
 * GET /api/network/telemetry           — Full telemetry summary
 * GET /api/network/telemetry/verifications — Verification rate + daily buckets
 * GET /api/network/telemetry/revocations   — Revocation rate + daily buckets
 * GET /api/network/telemetry/issuers       — Issuer activity breakdown
 * GET /api/network/telemetry/capsules      — Decision capsule generation rate
 */

import type { Express, Request, Response } from 'express';
import {
  getNetworkTelemetrySummary,
  getVerificationRate,
  getRevocationRate,
  getIssuerActivity,
  getDecisionCapsuleRate,
} from '../services/network/networkAnalytics';
import { log } from '../obs/logger';

export function registerNetworkAnalyticsRoutes(app: Express): void {
  /**
   * GET /api/network/telemetry?days=30
   * Full telemetry summary for the trust graph dashboard.
   */
  app.get('/api/network/telemetry', async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
      const summary = await getNetworkTelemetrySummary(days);
      res.json(summary);
    } catch (err) {
      log('error', 'networkAnalytics.telemetry failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to compute telemetry', detail: String(err) });
    }
  });

  /**
   * GET /api/network/telemetry/verifications?days=30
   */
  app.get('/api/network/telemetry/verifications', async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
      const result = await getVerificationRate(days);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to compute verification rate', detail: String(err) });
    }
  });

  /**
   * GET /api/network/telemetry/revocations?days=30
   */
  app.get('/api/network/telemetry/revocations', async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
      const result = await getRevocationRate(days);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to compute revocation rate', detail: String(err) });
    }
  });

  /**
   * GET /api/network/telemetry/issuers
   */
  app.get('/api/network/telemetry/issuers', async (_req: Request, res: Response) => {
    try {
      const result = await getIssuerActivity();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to compute issuer activity', detail: String(err) });
    }
  });

  /**
   * GET /api/network/telemetry/capsules?days=30
   */
  app.get('/api/network/telemetry/capsules', async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
      const result = await getDecisionCapsuleRate(days);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to compute capsule rate', detail: String(err) });
    }
  });
}
