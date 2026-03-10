/**
 * Wave 197 — Trust Anchor Routes
 *
 * All routes gated behind FEATURE_TRUST_ANCHORS env flag.
 */

import type { Express, Request, Response } from 'express';
import { parseBooleanEnv } from '../utils/environment';
import { isSuperAdminRequest } from '../middleware/tenantGuard';
import { log } from '../obs/logger';
import {
  listAnchors,
  getAnchor,
  revokeAnchor,
  isAnchorValid,
  getRevokeReason,
  type AnchorRootType,
  type AnchorStatus,
} from '../services/trust-anchors/anchors/anchorRegistry';
import { ingestAllTrustLists } from '../services/trust-anchors/anchorIngestion';
import { evaluatePolicy, listPolicies } from '../services/trust-anchors/verification-policies/policyEngine';
import { emitAnchorUpdateArtifact } from '../services/trust-anchors/auditEmitter';

function featureEnabled(): boolean {
  return parseBooleanEnv(process.env.FEATURE_TRUST_ANCHORS, false);
}

function ensureEnabled(res: Response): boolean {
  if (featureEnabled()) return true;
  res.status(404).json({ error: 'Not found' });
  return false;
}

export function registerTrustAnchorRoutes(app: Express): void {
  // GET /api/trust-anchors
  app.get('/api/trust-anchors', (req: Request, res: Response) => {
    if (!ensureEnabled(res)) return;

    const rootType = req.query.rootType as AnchorRootType | undefined;
    const status = req.query.status as AnchorStatus | undefined;
    const anchors = listAnchors({ rootType, status });

    res.status(200).json({ anchors, total: anchors.length });
  });

  // GET /api/trust-anchors/:id
  app.get('/api/trust-anchors/:id', (req: Request, res: Response) => {
    if (!ensureEnabled(res)) return;

    const anchor = getAnchor(req.params.id);
    if (!anchor) {
      res.status(404).json({ error: 'Anchor not found' });
      return;
    }

    res.status(200).json({
      anchor,
      valid: isAnchorValid(anchor.id),
      revokeReason: getRevokeReason(anchor.id),
    });
  });

  // POST /api/trust-anchors/ingest  (admin)
  app.post('/api/trust-anchors/ingest', (req: Request, res: Response) => {
    if (!ensureEnabled(res)) return;

    const adminKey = req.headers['x-admin-key'];
    if (!adminKey && !isSuperAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    try {
      const anchors = ingestAllTrustLists();
      log('info', 'trust_anchor_ingest_triggered', { count: anchors.length });
      res.status(200).json({ ingested: anchors.length, anchors: anchors.map((a) => ({ id: a.id, name: a.name, rootType: a.rootType })) });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log('error', 'trust_anchor_ingest_failed', { error: detail });
      res.status(500).json({ error: 'Ingestion failed', detail });
    }
  });

  // POST /api/trust-anchors/:id/revoke  (admin)
  app.post('/api/trust-anchors/:id/revoke', (req: Request, res: Response) => {
    if (!ensureEnabled(res)) return;

    const adminKey = req.headers['x-admin-key'];
    if (!adminKey && !isSuperAdminRequest(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { reason } = req.body as { reason?: string };
    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    const anchor = getAnchor(req.params.id);
    if (!anchor) {
      res.status(404).json({ error: 'Anchor not found' });
      return;
    }

    const ok = revokeAnchor(req.params.id, reason);
    if (ok) {
      emitAnchorUpdateArtifact({ ...anchor, status: 'REVOKED' }, 'revoked');
    }

    res.status(200).json({ revoked: ok, anchorId: req.params.id });
  });

  // GET /api/trust-anchors/:id/policy-eval/:policyId
  app.get('/api/trust-anchors/:id/policy-eval/:policyId', (req: Request, res: Response) => {
    if (!ensureEnabled(res)) return;

    const anchor = getAnchor(req.params.id);
    if (!anchor) {
      res.status(404).json({ error: 'Anchor not found' });
      return;
    }

    const result = evaluatePolicy(req.params.policyId, anchor);
    res.status(200).json({ anchorId: req.params.id, policyId: req.params.policyId, ...result });
  });

  // GET /api/trust-anchors/policies  (list available policies)
  app.get('/api/trust-anchors/policies', (req: Request, res: Response) => {
    if (!ensureEnabled(res)) return;
    res.status(200).json({ policies: listPolicies() });
  });
}
