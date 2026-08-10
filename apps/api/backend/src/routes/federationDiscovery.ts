/**
 * federationDiscovery.ts — Wave 166: Federation Discovery Routes
 *
 * GET  /api/network/federation/discover    — discover + list issuer candidates
 * POST /api/network/federation/discover    — discover + auto-register validated issuers
 * POST /api/network/federation/validate    — validate arbitrary federation metadata
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { requireInternalSecret } from '../middleware/internalSecret';
import {
  autoRegisterDiscoveredIssuers,
  discoverIssuers,
  validateFederationMetadata,
  type FederationMetadataCandidate,
} from '../services/network/federationDiscovery';

/**
 * AUTHORIZATION (2026-08-08). `POST /api/network/federation/validate` had no
 * authorization beyond the global tenant guard and no caller anywhere in the
 * repo. Operator secret.
 *
 * `POST /api/network/federation/discover` is now guarded too. Its web proxy
 * has no auth of its own, and its only UI caller (`DebugPanel`) is imported by
 * no page — so the proxy fronts dead UI and will simply 403.
 */
export function registerFederationDiscoveryRoutes(app: Express): void {
  // GET — discover candidates without registering
  app.get('/api/network/federation/discover', async (_req: Request, res: Response) => {
    try {
      const candidates = await discoverIssuers();
      res.json({
        discoveredAt: new Date().toISOString(),
        totalCandidates: candidates.length,
        validCandidates: candidates.filter((c) => c.metadataValid).length,
        alreadyRegistered: candidates.filter((c) => c.registered).length,
        issuers: candidates,
      });
    } catch (err) {
      log('error', 'federation_discover_route_error', { error: String(err) });
      res.status(500).json({ error: 'Discovery failed' });
    }
  });

  // POST — discover + auto-register validated issuers
  app.post('/api/network/federation/discover', requireInternalSecret, async (_req: Request, res: Response) => {
    try {
      const report = await autoRegisterDiscoveredIssuers();
      res.json(report);
    } catch (err) {
      log('error', 'federation_auto_register_error', { error: String(err) });
      res.status(500).json({ error: 'Auto-registration failed' });
    }
  });

  // POST — validate arbitrary federation metadata
  app.post('/api/network/federation/validate', requireInternalSecret, (req: Request, res: Response) => {
    try {
      const candidate = req.body as FederationMetadataCandidate;
      if (!candidate || typeof candidate !== 'object') {
        res.status(400).json({ error: 'Request body must be a JSON federation metadata object' });
        return;
      }
      const result = validateFederationMetadata(candidate);
      res.json({ ...result, validatedAt: new Date().toISOString() });
    } catch (err) {
      log('error', 'federation_validate_error', { error: String(err) });
      res.status(500).json({ error: 'Validation failed' });
    }
  });
}
