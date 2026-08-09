/**
 * issuerOnboarding.ts — Wave 106 + Wave 138: Issuer Onboarding API Routes
 *
 * POST /api/network/issuer/register — Onboard a new issuer (with federationMetadata)
 * GET  /api/network/issuer          — List all onboarded issuers
 */

import type { Express, Request, Response } from 'express';
import {
  onboardIssuer,
  listOnboardedIssuers,
  type IssuerOnboardingRequest,
} from '../services/network/issuerOnboarding';
import { initializeTrustRegistryPersistence } from '../services/registry/trustRegistry';
import { log } from '../obs/logger';
import { requireInternalSecret } from '../middleware/internalSecret';

/**
 * AUTHORIZATION (2026-08-08). `POST /api/network/issuer/register` had no
 * authorization beyond the global tenant guard, which accepted the mere
 * PRESENCE of a caller-supplied `x-org-id` — so anyone could register an
 * issuer. Operator secret; its only caller, `IssuerOnboardingPanel`, is
 * imported by no page.
 */
export function registerIssuerOnboardingRoutes(app: Express): void {
  /**
   * POST /api/network/issuer/register
   *
   * Body: {
   *   issuerName: string,
   *   issuerDID: string,
   *   verificationEndpoint: string,
   *   trustLevel: 'AUTHORITATIVE' | 'TRUSTED' | 'UNVERIFIED',
   *   federationMetadata?: {                    // Wave 138
   *     entityStatementEndpoint?: string,
   *     didMethods?: string[],
   *     oidcFederationEnabled?: boolean,
   *     federatedNetworkIds?: string[],
   *     notes?: string,
   *   }
   * }
   */
  app.post('/api/network/issuer/register', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      const body = req.body as IssuerOnboardingRequest;

      // Validate trust level enum
      const validTrustLevels = ['AUTHORITATIVE', 'TRUSTED', 'UNVERIFIED'];
      if (body.trustLevel && !validTrustLevels.includes(body.trustLevel)) {
        res.status(400).json({
          error: `trustLevel must be one of: ${validTrustLevels.join(', ')}`,
        });
        return;
      }

      const result = await onboardIssuer(body);

      if (result.status === 'FAILED') {
        res.status(400).json({ error: result.message, result });
        return;
      }

      log('info', 'issuerOnboarding: registered', {
        issuerId: result.issuerId,
        hasFederationMetadata: Boolean(result.federationMetadata),
      });

      res.status(201).json(result);
    } catch (err) {
      log('error', 'issuerOnboarding: register failed', { detail: String(err) });
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
      log('error', 'issuerOnboarding: list failed', { detail: String(err) });
      res.status(500).json({ error: 'Internal server error', detail: String(err) });
    }
  });
}
