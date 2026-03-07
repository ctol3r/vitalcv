/**
 * payerVerification.ts — Wave 142: Payer Network Integration API Routes
 *
 * GET  /api/payers/verify/:npi        — Check provider eligibility for a payer
 * POST /api/payers/verifyBundle       — Validate a credential bundle
 * GET  /api/payers/network/:npi       — Check network status
 * GET  /api/payers                    — List registered payer nodes
 */

import type { Express, Request, Response } from 'express';
import {
  verifyProviderEligibility,
  verifyCredentialBundle,
  checkNetworkStatus,
  listPayerNodes,
} from '../services/payers/payerVerification';
import { log } from '../obs/logger';

export function registerPayerVerificationRoutes(app: Express): void {
  /**
   * GET /api/payers/verify/:npi?payerId=payer:unitedhealth
   * Verify provider eligibility with a specific payer.
   */
  app.get('/api/payers/verify/:npi', async (req: Request, res: Response) => {
    try {
      const { npi } = req.params;
      const payerId = (req.query.payerId as string) || 'payer:unitedhealth';
      const result = await verifyProviderEligibility(npi, payerId);
      res.json(result);
    } catch (err) {
      log('error', 'payer_verify_route_error', { error: String(err) });
      res.status(500).json({ error: 'Payer verification failed' });
    }
  });

  /**
   * POST /api/payers/verifyBundle
   * Body: { npi: string, payerId: string, credentialIds: string[] }
   */
  app.post('/api/payers/verifyBundle', async (req: Request, res: Response) => {
    try {
      const { npi, payerId, credentialIds } = req.body as {
        npi: string;
        payerId: string;
        credentialIds: string[];
      };

      if (!npi || !payerId || !Array.isArray(credentialIds)) {
        res.status(400).json({ error: 'Missing npi, payerId, or credentialIds[]' });
        return;
      }

      const result = await verifyCredentialBundle(npi, payerId, credentialIds);
      res.json(result);
    } catch (err) {
      log('error', 'payer_bundle_route_error', { error: String(err) });
      res.status(500).json({ error: 'Bundle verification failed' });
    }
  });

  /**
   * GET /api/payers/network/:npi?payerId=payer:unitedhealth
   * Check network status for a provider.
   */
  app.get('/api/payers/network/:npi', async (req: Request, res: Response) => {
    try {
      const { npi } = req.params;
      const payerId = (req.query.payerId as string) || 'payer:unitedhealth';
      const result = await checkNetworkStatus(npi, payerId);
      res.json(result);
    } catch (err) {
      log('error', 'payer_network_route_error', { error: String(err) });
      res.status(500).json({ error: 'Network status check failed' });
    }
  });

  /**
   * GET /api/payers — List all registered payer nodes.
   */
  app.get('/api/payers', (_req: Request, res: Response) => {
    try {
      const payers = listPayerNodes();
      res.json({ payers, count: payers.length });
    } catch (err) {
      log('error', 'payer_list_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to list payers' });
    }
  });
}
