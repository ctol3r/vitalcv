/**
 * trustSubstrate.ts (route) — Substrate Consolidation: Phase 1
 *
 * GET  /api/trust/substrate/:subject   — Full substrate trust state (NPI or DID)
 * GET  /api/trust/substrate/:subject/band — Lightweight band-only check
 */

import type { Express, Request, Response } from 'express';
import { computeSubstrateTrustState, getSubstrateBand, TRUST_BAND_LABELS } from '../services/trust/trustSubstrate';
import { log } from '../obs/logger';

export function registerTrustSubstrateRoutes(app: Express): void {
  /**
   * GET /api/trust/substrate/:subject
   * Returns the full substrate trust state for a clinician (NPI or DID).
   */
  app.get('/api/trust/substrate/:subject', async (req: Request, res: Response) => {
    const { subject } = req.params;
    if (!subject) {
      res.status(400).json({ error: 'subject parameter is required' });
      return;
    }

    try {
      const result = await computeSubstrateTrustState(subject);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'trust_substrate: full state failed', { subject, error: message });
      res.status(500).json({ error: 'Failed to compute substrate trust state' });
    }
  });

  /**
   * GET /api/trust/substrate/:subject/band
   * Lightweight band-only endpoint — suitable for hot paths and UI badges.
   */
  app.get('/api/trust/substrate/:subject/band', async (req: Request, res: Response) => {
    const { subject } = req.params;
    if (!subject) {
      res.status(400).json({ error: 'subject parameter is required' });
      return;
    }

    try {
      const band = await getSubstrateBand(subject);
      res.json({
        subject,
        band,
        bandLabel: TRUST_BAND_LABELS[band],
        computedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'trust_substrate: band check failed', { subject, error: message });
      res.status(500).json({ error: 'Failed to compute trust band' });
    }
  });
}
