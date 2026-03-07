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
import { getRequestOrganizationId } from '../middleware/organizationContext';
import { generateIssuanceReceipt } from '../services/audit/receiptGenerator';
import { auditIssuance, newTraceId } from '../services/audit/auditLedger';
import { upsertVerificationArtifactFromCredential } from '../services/credentials/credentialArtifactBridge';
import { log } from '../obs/logger';

function getSigningKey(): string {
  return process.env.CREDENTIAL_SIGNING_KEY_PEM ?? '';
}

function withCredentialTypeClaims(
  claims: Record<string, unknown>,
  credentialType: string,
  npi: string,
): Record<string, unknown> {
  const existingTypes = Array.isArray(claims.type)
    ? claims.type.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    ...claims,
    npi,
    credentialType,
    type: existingTypes.length > 0
      ? Array.from(new Set(['VerifiableCredential', ...existingTypes, credentialType]))
      : ['VerifiableCredential', credentialType],
  };
}

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

  // ── POST /api/oid4vci/offer ────────────────────────────────────────
  app.post('/api/oid4vci/offer', (req: Request, res: Response) => {
    try {
      const { npi, credentialType, claims, ttlSeconds, issuerId } = req.body ?? {};

      if (!npi || typeof npi !== 'string') {
        res.status(400).json({ error: 'npi is required' });
        return;
      }
      if (!credentialType || typeof credentialType !== 'string') {
        res.status(400).json({ error: 'credentialType is required' });
        return;
      }
      if (!issuerId || typeof issuerId !== 'string') {
        res.status(400).json({ error: 'issuerId is required' });
        return;
      }

      const offer = createCredentialOffer(
        [credentialType],
        {
          issuer: issuerId,
          subject: npi,
          claims: withCredentialTypeClaims(
            typeof claims === 'object' && claims !== null ? claims as Record<string, unknown> : {},
            credentialType,
            npi,
          ),
        },
        typeof ttlSeconds === 'number' ? ttlSeconds : 300,
      );
      const credentialOfferUri = `${offer.credential_issuer}/api/oid4vci/credential-offer/${offer.offerId}`;

      res.status(201).json({
        ...offer,
        credentialOfferUri,
        qrCodeUri: credentialOfferUri,
        issuer: issuerId,
        credentialType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'oid4vci_sdk_offer_create_error', { error: msg });
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

      const signingKey = getSigningKey();
      if (!signingKey) {
        res.status(503).json({ error: 'CREDENTIAL_SIGNING_KEY_PEM not configured' });
        return;
      }

      const response = await issueOID4VCICredential(
        { format: format as import('../services/oid4vci/issuanceServer').CredentialFormatId, types, proof, 'pre-authorized_code': preCode },
        signingKey,
      );

      if (response.issuedCredential) {
        const traceId = newTraceId();
        const auditEvent = auditIssuance({
          traceId,
          actor: response.issuedCredential.issuer,
          credentialId: response.issuedCredential.credentialId,
          subject: response.issuedCredential.subject,
          issuer: response.issuedCredential.issuer,
          success: true,
        });
        const receipt = await generateIssuanceReceipt(response.issuedCredential).catch((error) => {
          log('warn', 'oid4vci_issue_receipt_failed', {
            credentialId: response.issuedCredential?.credentialId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return null;
        });
        await upsertVerificationArtifactFromCredential(response.issuedCredential, {
          organizationId: getRequestOrganizationId(req),
          source: response.issuedCredential.issuer,
        });

        res.status(200).json({
          ...response,
          receiptId: receipt?.receiptId ?? null,
          receiptHash: receipt?.hash ?? auditEvent.receiptHash,
          traceId,
        });
        return;
      }

      res.status(200).json(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'oid4vci_issue_error', { error: msg });
      const status = msg.includes('expired') || msg.includes('redeemed') ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // ── POST /api/oid4vci/accept ───────────────────────────────────────
  app.post('/api/oid4vci/accept', async (req: Request, res: Response) => {
    try {
      const { offerId, npi } = req.body ?? {};

      if (!offerId || typeof offerId !== 'string') {
        res.status(400).json({ error: 'offerId is required' });
        return;
      }
      if (!npi || typeof npi !== 'string') {
        res.status(400).json({ error: 'npi is required' });
        return;
      }

      const signingKey = getSigningKey();
      if (!signingKey) {
        res.status(503).json({ error: 'CREDENTIAL_SIGNING_KEY_PEM not configured' });
        return;
      }

      const offer = getCredentialOffer(offerId);
      if (!offer) {
        res.status(404).json({ error: 'Credential offer not found' });
        return;
      }

      const preAuthorizedCode =
        offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code'];
      const response = await issueOID4VCICredential(
        {
          format: 'jwt_vc_json',
          types: offer.credentials,
          'pre-authorized_code': preAuthorizedCode,
        },
        signingKey,
        npi,
      );

      if (!response.issuedCredential) {
        res.status(500).json({ error: 'Credential issuance response missing credential payload' });
        return;
      }

      const credential = response.issuedCredential;
      const traceId = newTraceId();
      const auditEvent = auditIssuance({
        traceId,
        actor: credential.issuer,
        credentialId: credential.credentialId,
        subject: credential.subject,
        issuer: credential.issuer,
        success: true,
      });
      const receipt = await generateIssuanceReceipt(credential).catch((error) => {
        log('warn', 'oid4vci_accept_receipt_failed', {
          credentialId: credential.credentialId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
      });

      await upsertVerificationArtifactFromCredential(credential, {
        organizationId: getRequestOrganizationId(req),
        source: credential.issuer,
      });

      res.status(200).json({
        offer,
        credential,
        credentialId: credential.credentialId,
        credentialType: offer.credentials[0] ?? 'VerifiableCredential',
        issuer: credential.issuer,
        storedAt: new Date().toISOString(),
        receiptId: receipt?.receiptId ?? null,
        receiptHash: receipt?.hash ?? auditEvent.receiptHash,
        traceId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'oid4vci_accept_error', { error: msg });
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
