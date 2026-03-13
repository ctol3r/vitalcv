/**
 * trustStateEngine.ts (routes) — Wave 243: Trust State Engine Routes
 *
 * Routes:
 *   GET  /api/trust-state/:npi          — get current trust state (cached ≤1h or fresh)
 *   POST /api/trust-state/:npi/refresh  — force recomputation (requires x-clerk-user-id)
 *   GET  /api/trust-state/:npi/history  — past trust state snapshots
 */

import type { Express, Request, Response } from 'express';
import {
  computeClinicianTrustState,
  refreshTrustState,
  getTrustStateHistory,
  getCachedTrustState,
} from '../services/trust/trustStateEngine';
import { log } from '../obs/logger';

// ── NPI validation ────────────────────────────────────────────────────────────

function isValidNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerTrustStateEngineRoutes(app: Express): void {

  /**
   * GET /api/trust-state/:npi
   * Returns the current trust state. Uses cache if computed within the last hour;
   * otherwise computes fresh (no side effects).
   */
  app.get('/api/trust-state/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    try {
      // Try cache first
      const cached = await getCachedTrustState(npi);
      if (cached) {
        return res.status(200).json({ ...cached, cached: true });
      }

      // Fresh computation (no DB write)
      const state = await computeClinicianTrustState(npi);
      return res.status(200).json({ ...state, cached: false });
    } catch (err) {
      log('error', 'trust_state_get_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to compute trust state' });
    }
  });

  /**
   * POST /api/trust-state/:npi/refresh
   * Forces recomputation and persists snapshot. Requires x-clerk-user-id header.
   */
  app.post('/api/trust-state/:npi/refresh', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const clerkUserId = req.headers['x-clerk-user-id'];

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Authentication required — x-clerk-user-id header missing' });
    }

    try {
      const state = await refreshTrustState(npi);
      return res.status(200).json({ ...state, cached: false });
    } catch (err) {
      log('error', 'trust_state_refresh_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to refresh trust state' });
    }
  });

  /**
   * GET /api/trust-state/:npi/history
   * Returns past trust state snapshots (most recent first).
   */
  app.get('/api/trust-state/:npi/history', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const limitRaw = req.query.limit;
    const limit = typeof limitRaw === 'string' ? Math.min(parseInt(limitRaw, 10) || 10, 50) : 10;

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    try {
      const history = await getTrustStateHistory(npi, limit);
      return res.status(200).json({ npi, history, count: history.length });
    } catch (err) {
      log('error', 'trust_state_history_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to retrieve trust state history' });
    }
  });
}
