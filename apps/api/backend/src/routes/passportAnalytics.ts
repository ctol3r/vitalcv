/**
 * passportAnalytics.ts — Wave 167: Passport Viral Sharing Analytics Routes
 *
 * GET  /api/passport/analytics           — network-wide summary
 * GET  /api/passport/analytics/:npi      — per-NPI analytics
 * POST /api/passport/analytics/:npi/share     — record share event
 * POST /api/passport/analytics/:npi/qr        — record QR view
 * POST /api/passport/analytics/:npi/download  — record bundle download
 * POST /api/passport/analytics/:npi/accept    — record verifier accept
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  getNetworkPassportSummary,
  getPassportAnalytics,
  recordBundleDownload,
  recordQrView,
  recordShare,
  recordVerifierAccept,
} from '../services/network/passportAnalytics';

export function registerPassportAnalyticsRoutes(app: Express): void {
  // Network-wide summary
  app.get('/api/passport/analytics', (_req: Request, res: Response) => {
    try {
      res.json(getNetworkPassportSummary());
    } catch (err) {
      log('error', 'passport_analytics_summary_error', { error: String(err) });
      res.status(500).json({ error: 'Analytics unavailable' });
    }
  });

  // Per-NPI analytics
  app.get('/api/passport/analytics/:npi', (req: Request, res: Response) => {
    try {
      const { npi } = req.params;
      const analytics = getPassportAnalytics(npi);
      if (!analytics) {
        res.json({ npi, shareCount: 0, qrViews: 0, bundleDownloads: 0, verifierAccepts: 0, viralCoefficient: 0 });
        return;
      }
      res.json(analytics);
    } catch (err) {
      log('error', 'passport_analytics_npi_error', { error: String(err) });
      res.status(500).json({ error: 'Analytics unavailable' });
    }
  });

  // Record share
  app.post('/api/passport/analytics/:npi/share', (req: Request, res: Response) => {
    const { npi } = req.params;
    recordShare(npi);
    res.json({ ok: true, event: 'share', npi });
  });

  // Record QR view
  app.post('/api/passport/analytics/:npi/qr', (req: Request, res: Response) => {
    const { npi } = req.params;
    recordQrView(npi);
    res.json({ ok: true, event: 'qr_view', npi });
  });

  // Record bundle download
  app.post('/api/passport/analytics/:npi/download', (req: Request, res: Response) => {
    const { npi } = req.params;
    recordBundleDownload(npi);
    res.json({ ok: true, event: 'bundle_download', npi });
  });

  // Record verifier accept
  app.post('/api/passport/analytics/:npi/accept', (req: Request, res: Response) => {
    const { npi } = req.params;
    recordVerifierAccept(npi);
    res.json({ ok: true, event: 'verifier_accept', npi });
  });
}
