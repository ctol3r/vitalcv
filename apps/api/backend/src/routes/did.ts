/**
 * did.ts — Wave 100: DID API Routes
 *
 * POST /api/did/register    — Register a new DID document
 * GET  /api/did/:did        — Resolve a DID to its document
 * GET  /api/did             — List registered DIDs (with optional type filter)
 * PATCH /api/did/:did/status — Update DID status (deactivate/revoke)
 * PATCH /api/did/:did/key   — Rotate the public key for a DID
 */

import type { Express, Request, Response } from 'express';
import {
  registerDID,
  listDIDs,
  updateDIDStatus,
  rotateDIDKey,
  type DIDSubjectType,
  type DIDStatus,
} from '../services/identity/didRegistry';
import { resolveDid } from '../services/identity/didResolver';
import { requireInternalSecret } from '../middleware/internalSecret';
import { log } from '../obs/logger';

/**
 * AUTHORIZATION (2026-08-08). Register and the two PATCH routes had NO
 * authorization — reachable by any anonymous caller who set `x-org-id` to any
 * value. `POST /api/did/register` accepts a caller-supplied `publicKey` and
 * binds it to a new DID: unauthenticated identity injection. The PATCH routes
 * rotate a DID's key and flip its status.
 *
 * Scope note, stated precisely: `didRegistry` stores documents in a
 * process-local `Map`, so these writes do not survive a restart and are not
 * shared across instances. That bounds the blast radius; it is not a control,
 * and every other route that reads the registry trusts what was injected.
 *
 * Operator secret; no caller for these paths exists anywhere in the repo.
 */
export function registerDIDRoutes(app: Express): void {

  // ── POST /api/did/register ─────────────────────────────────────────
  app.post('/api/did/register', requireInternalSecret, (req: Request, res: Response) => {
    try {
      const { subjectType, identifier, publicKey, label, controller, serviceEndpoints, metadata } =
        req.body ?? {};

      const validTypes: DIDSubjectType[] = ['clinician', 'issuer', 'verifier', 'system'];
      if (!subjectType || !validTypes.includes(subjectType)) {
        res.status(400).json({ error: `subjectType must be one of ${validTypes.join(', ')}` });
        return;
      }
      if (!publicKey || typeof publicKey !== 'string') {
        res.status(400).json({ error: 'publicKey (SPKI PEM) is required' });
        return;
      }

      const doc = registerDID({
        subjectType,
        identifier,
        publicKey,
        label,
        controller,
        serviceEndpoints,
        metadata,
      });

      res.status(201).json({ did: doc.did, document: doc });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('already registered')) {
        res.status(409).json({ error: msg });
        return;
      }
      log('error', 'did_register_failed', { error: msg });
      res.status(500).json({ error: 'Failed to register DID', detail: msg });
    }
  });

  // ── GET /api/did — list ────────────────────────────────────────────
  app.get('/api/did', (req: Request, res: Response) => {
    try {
      const { type } = req.query;
      const docs = listDIDs(type as DIDSubjectType | undefined);
      res.status(200).json({
        documents: docs,
        total: docs.length,
        retrievedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'did_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list DIDs', detail: msg });
    }
  });

  // ── GET /api/did/:did — resolve ────────────────────────────────────
  // Note: DID contains colons, so we read the full param via wildcard
  app.get('/api/did/:method/:subtype/:id', async (req: Request, res: Response) => {
    try {
      const { method, subtype, id } = req.params;
      const did = `did:${method}:${subtype}:${id}`;
      const result = await resolveDid(did);

      if (result.status === 'not_found') {
        res.status(404).json({ error: `DID ${did} not found`, resolution: result });
        return;
      }
      if (result.status === 'invalid') {
        res.status(400).json({ error: `Invalid DID format: ${did}`, resolution: result });
        return;
      }

      res.status(200).json({ resolution: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'did_resolve_failed', { error: msg });
      res.status(500).json({ error: 'Failed to resolve DID', detail: msg });
    }
  });

  // ── PATCH /api/did/:method/:subtype/:id/status ─────────────────────
  app.patch('/api/did/:method/:subtype/:id/status', requireInternalSecret, (req: Request, res: Response) => {
    try {
      const { method, subtype, id } = req.params;
      const did = `did:${method}:${subtype}:${id}`;
      const { status } = req.body ?? {};

      const validStatuses: DIDStatus[] = ['ACTIVE', 'DEACTIVATED', 'REVOKED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: `status must be one of ${validStatuses.join(', ')}` });
        return;
      }

      const updated = updateDIDStatus(did, status as DIDStatus);
      if (!updated) {
        res.status(404).json({ error: `DID ${did} not found` });
        return;
      }

      res.status(200).json({ document: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'did_status_update_failed', { error: msg });
      res.status(500).json({ error: 'Failed to update DID status', detail: msg });
    }
  });

  // ── PATCH /api/did/:method/:subtype/:id/key ────────────────────────
  app.patch('/api/did/:method/:subtype/:id/key', requireInternalSecret, (req: Request, res: Response) => {
    try {
      const { method, subtype, id } = req.params;
      const did = `did:${method}:${subtype}:${id}`;
      const { publicKey } = req.body ?? {};

      if (!publicKey || typeof publicKey !== 'string') {
        res.status(400).json({ error: 'publicKey (SPKI PEM) is required' });
        return;
      }

      const updated = rotateDIDKey(did, publicKey);
      if (!updated) {
        res.status(404).json({ error: `DID ${did} not found or inactive` });
        return;
      }

      res.status(200).json({ document: updated, message: 'Key rotated successfully' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'did_key_rotation_failed', { error: msg });
      res.status(500).json({ error: 'Failed to rotate DID key', detail: msg });
    }
  });
}
