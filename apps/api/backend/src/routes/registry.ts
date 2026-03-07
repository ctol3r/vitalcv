/**
 * registry.ts — Wave 95 + 105: Trust Registry + Reputation API Routes
 *
 * GET  /api/registry                  — List all trusted issuers
 * GET  /api/registry/:issuer          — Get a specific issuer by ID
 * POST /api/registry                  — Register or update an issuer (admin)
 * PATCH /api/registry/:issuer/status  — Update status
 * GET  /api/registry/reputation       — Wave 105: Calculate all reputation scores
 * GET  /api/registry/:issuer/reputation — Wave 105: Get single issuer reputation
 */

import type { Express, Request, Response } from 'express';
import {
  listIssuers,
  getIssuer,
  registerIssuer,
  initializeTrustRegistryPersistence,
  updateIssuerStatus,
  type TrustedIssuer,
  type IssuerStatus,
} from '../services/registry/trustRegistry';
import {
  calculateAllReputations,
  calculateReputation,
  getNetworkReputationSummary,
} from '../services/trust/reputationEngine';
import { log } from '../obs/logger';

export function registerTrustRegistryRoutes(app: Express): void {

  // ── GET /api/registry ───────────────────────────────────────────────
  app.get('/api/registry', async (_req: Request, res: Response) => {
    try {
      await initializeTrustRegistryPersistence();
      const issuers = listIssuers();
      res.status(200).json({
        issuers,
        total: issuers.length,
        retrievedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'registry_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list issuers', detail: msg });
    }
  });

  // ── GET /api/registry/issuers ───────────────────────────────────────
  app.get('/api/registry/issuers', async (_req: Request, res: Response) => {
    try {
      await initializeTrustRegistryPersistence();
      const issuers = listIssuers();
      res.status(200).json({ issuers, total: issuers.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'registry_sdk_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list issuers', detail: msg });
    }
  });

  // ── POST /api/registry/issuers ──────────────────────────────────────
  app.post('/api/registry/issuers', async (req: Request, res: Response) => {
    try {
      const {
        did,
        issuerId,
        issuerName,
        issuerType,
        jurisdiction,
        endpoint,
        publicKey,
      } = req.body ?? {};

      const resolvedIssuerId = typeof did === 'string' && did.trim().length > 0
        ? did.trim()
        : issuerId;

      if (!resolvedIssuerId || typeof resolvedIssuerId !== 'string') {
        res.status(400).json({ error: 'did or issuerId is required' });
        return;
      }
      if (!issuerName || typeof issuerName !== 'string') {
        res.status(400).json({ error: 'issuerName is required' });
        return;
      }

      const issuer: TrustedIssuer = {
        issuerId: resolvedIssuerId,
        issuerName,
        publicKey: typeof publicKey === 'string' ? publicKey : '',
        trustLevel: 'AUTHORITATIVE',
        status: 'ACTIVE',
        registeredAt: new Date().toISOString(),
        trustScore: 90,
        assuranceProfile: 'IAL2',
        algorithmPolicy: ['ES256'],
        haipCompliant: true,
        metadata: {
          assuranceLevel: 'IAL2',
          issuerType,
          jurisdiction,
          endpoint,
        },
      };

      const persisted = await registerIssuer(issuer);
      res.status(201).json({
        issuer: persisted,
        issuerId: persisted.issuerId,
        issuerName: persisted.issuerName,
        did: persisted.issuerId,
        trustScore: persisted.trustScore ?? 0,
        status: persisted.status,
        registeredAt: persisted.registeredAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'registry_sdk_register_failed', { error: msg });
      res.status(500).json({ error: 'Failed to register issuer', detail: msg });
    }
  });

  // ── GET /api/registry/:issuer ──────────────────────────────────────
  app.get('/api/registry/:issuer', async (req: Request, res: Response) => {
    try {
      await initializeTrustRegistryPersistence();
      // issuerId may be URL-encoded (e.g. did:vitalcv:issuer:ca-medical-board)
      const issuerId = decodeURIComponent(req.params.issuer ?? '');
      const issuer = getIssuer(issuerId);

      if (!issuer) {
        res.status(404).json({ error: `Issuer "${issuerId}" not found in trust registry` });
        return;
      }

      res.status(200).json({ issuer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'registry_get_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve issuer', detail: msg });
    }
  });

  // ── POST /api/registry ─────────────────────────────────────────────
  // Admin endpoint to register a new trusted issuer
  app.post('/api/registry', async (req: Request, res: Response) => {
    try {
      const { issuerId, issuerName, publicKey, trustLevel, status, metadata } = req.body ?? {};

      if (!issuerId || typeof issuerId !== 'string') {
        res.status(400).json({ error: 'issuerId is required' });
        return;
      }
      if (!issuerName || typeof issuerName !== 'string') {
        res.status(400).json({ error: 'issuerName is required' });
        return;
      }

      const validTrustLevels = ['AUTHORITATIVE', 'TRUSTED', 'PROVISIONAL', 'UNTRUSTED'];
      if (trustLevel && !validTrustLevels.includes(trustLevel)) {
        res.status(400).json({ error: `trustLevel must be one of ${validTrustLevels.join(', ')}` });
        return;
      }

      const issuer: TrustedIssuer = {
        issuerId,
        issuerName,
        publicKey: publicKey ?? '',
        trustLevel: trustLevel ?? 'PROVISIONAL',
        status: (status ?? 'ACTIVE') as IssuerStatus,
        registeredAt: new Date().toISOString(),
        metadata: metadata ?? {},
      };

      const persisted = await registerIssuer(issuer);
      res.status(201).json({ issuer: persisted, message: 'Issuer registered successfully' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'registry_register_failed', { error: msg });
      res.status(500).json({ error: 'Failed to register issuer', detail: msg });
    }
  });

  // ── PATCH /api/registry/:issuer/status ────────────────────────────
  app.patch('/api/registry/:issuer/status', async (req: Request, res: Response) => {
    try {
      const issuerId = decodeURIComponent(req.params.issuer ?? '');
      const { status } = req.body ?? {};

      const validStatuses: IssuerStatus[] = ['ACTIVE', 'SUSPENDED', 'REVOKED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: `status must be one of ${validStatuses.join(', ')}` });
        return;
      }

      const updated = await updateIssuerStatus(issuerId, status as IssuerStatus);
      if (!updated) {
        res.status(404).json({ error: `Issuer "${issuerId}" not found` });
        return;
      }

      res.status(200).json({ issuer: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'registry_status_update_failed', { error: msg });
      res.status(500).json({ error: 'Failed to update issuer status', detail: msg });
    }
  });

  // ── GET /api/reputation/network (Wave 141) ────────────────────────
  // Network-level aggregated trust score — used by GlobalTrustMap for live
  // node coloring and Mission Ops reputation dashboard.
  app.get('/api/reputation/network', async (_req: Request, res: Response) => {
    try {
      const summary = await getNetworkReputationSummary();
      res.status(200).json(summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'reputation_network_summary_failed', { error: msg });
      res.status(500).json({ error: 'Failed to compute network reputation', detail: msg });
    }
  });

  // ── GET /api/registry/reputation (Wave 105) ────────────────────────
  // Must be registered before /api/registry/:issuer to avoid "reputation"
  // being captured as an :issuer param
  app.get('/api/registry/reputation', async (_req: Request, res: Response) => {
    try {
      const reputations = await calculateAllReputations();
      res.status(200).json({
        reputations,
        total: reputations.length,
        calculatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'reputation_calculate_all_failed', { error: msg });
      res.status(500).json({ error: 'Failed to calculate reputations', detail: msg });
    }
  });

  // ── GET /api/registry/:issuer/reputation (Wave 105) ───────────────
  app.get('/api/registry/:issuer/reputation', async (req: Request, res: Response) => {
    try {
      const issuerId = decodeURIComponent(req.params.issuer ?? '');
      const reputation = await calculateReputation(issuerId);

      if (!reputation) {
        res.status(404).json({ error: `Issuer "${issuerId}" not found or not scored` });
        return;
      }

      res.status(200).json({ reputation });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'reputation_calculate_single_failed', { error: msg });
      res.status(500).json({ error: 'Failed to calculate reputation', detail: msg });
    }
  });
}
