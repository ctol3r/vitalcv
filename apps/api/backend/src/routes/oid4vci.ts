/**
 * oid4vci.ts — Wave 109: OpenID4VCI Issuance API Routes
 *
 * GET  /api/oid4vci/.well-known/openid-credential-issuer — Issuer metadata
 * GET  /api/oid4vci/credential-offer/:id                 — Retrieve a credential offer
 * POST /api/oid4vci/credential-offer                     — Create a credential offer
 * POST /api/oid4vci/credential                           — Issue a credential (pre-auth code flow)
 */

import type { Express, Request, Response } from 'express';
import {
  createIssuerMetadata,
  createCredentialOffer,
  getCredentialOffer,
  issueOID4VCICredential,
  listActiveOffers,
} from '../services/oid4vci/issuanceServer';
import { log } from '../obs/logger';

const DEV_SIGNING_KEY_PEM = process.env.CREDENTIAL_SIGNING_KEY_PEM ?? '';

export function registerOID4VCIRoutes(app: Express): void {

  // ── GET /.well-known/openid-credential-issuer ──────────────────────
  app.get('/api/oid4vci/.well-known/openid-credential-issuer', (_req: Request, res: Response) => {
    try {
      const metadata = createIssuerMetadata();
      res.json(metadata);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'oid4vci_metadata_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/oid4vci/credential-offer/:id ─────────────────────────
  app.get('/api/oid4vci/credential-offer/:id', (req: Request, res: Response) => {
    try {
      const offer = getCredentialOffer(req.params.id);
      if (!offer) {
        res.status(404).json({ error: 'Credential offer not found' });
        return;
      }
      res.json(offer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── POST /api/oid4vci/credential-offer ───────────────────────────
  app.post('/api/oid4vci/credential-offer', (req: Request, res: Response) => {
    try {
      const { credentialIds, pendingRequest, ttlSeconds } = req.body ?? {};

      if (!credentialIds || !Array.isArray(credentialIds) || credentialIds.length === 0) {
        res.status(400).json({ error: 'credentialIds array is required' });
        return;
      }

      const offer = createCredentialOffer(
        credentialIds as string[],
        pendingRequest,
        typeof ttlSeconds === 'number' ? ttlSeconds : 600,
      );

      res.status(201).json(offer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'oid4vci_offer_create_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── POST /api/oid4vci/credential ─────────────────────────────────
  app.post('/api/oid4vci/credential', async (req: Request, res: Response) => {
    try {
      const { format, types, proof } = req.body ?? {};
      const preCode = req.body['pre-authorized_code'];

      if (!format || typeof format !== 'string') {
        res.status(400).json({ error: 'format is required' });
        return;
      }
      if (!types || !Array.isArray(types) || types.length === 0) {
        res.status(400).json({ error: 'types array is required' });
        return;
      }

      if (!DEV_SIGNING_KEY_PEM) {
        res.status(503).json({ error: 'CREDENTIAL_SIGNING_KEY_PEM not configured' });
        return;
      }

      const response = await issueOID4VCICredential(
        { format: format as import('../services/oid4vci/issuanceServer').CredentialFormatId, types, proof, 'pre-authorized_code': preCode },
        DEV_SIGNING_KEY_PEM,
      );

      res.status(200).json(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'oid4vci_issue_error', { error: msg });
      const status = msg.includes('expired') || msg.includes('redeemed') ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // ── GET /api/oid4vci/offers — admin: list active offers ───────────
  app.get('/api/oid4vci/offers', (_req: Request, res: Response) => {
    try {
      const active = listActiveOffers();
      res.json({ offers: active, count: active.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });
}
