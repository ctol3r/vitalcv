/**
 * issuerOnboarding.ts — Wave 106: Issuer Onboarding API Routes
 *
 * POST /api/network/issuer/register — Onboard a new issuer
 * GET  /api/network/issuer          — List all onboarded issuers
 */

import type { Express, Request, Response } from 'express';
import {
  onboardIssuer,
  listOnboardedIssuers,
  type IssuerOnboardingRequest,
} from '../services/network/issuerOnboarding';
import { initializeTrustRegistryPersistence } from '../services/registry/trustRegistry';

export function registerIssuerOnboardingRoutes(app: Express): void {
  /**
   * POST /api/network/issuer/register
   * Body: { issuerName, issuerDID, verificationEndpoint, trustLevel }
   */
  app.post('/api/network/issuer/register', async (req: Request, res: Response) => {
    try {
      const body = req.body as IssuerOnboardingRequest;
      const result = await onboardIssuer(body);

      if (result.status === 'FAILED') {
        res.status(400).json({ error: result.message, result });
        return;
      }

      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', detail: String(err) });
    }
  });

  /**
   * GET /api/network/issuer
   * Returns all onboarded issuers from the trust registry.
   */
  app.get('/api/network/issuer', async (_req: Request, res: Response) => {
    try {
      await initializeTrustRegistryPersistence();
      const issuers = listOnboardedIssuers();
      res.json({ issuers, count: issuers.length });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', detail: String(err) });
    }
  });
}
