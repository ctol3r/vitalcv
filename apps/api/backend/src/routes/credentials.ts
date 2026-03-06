/**
 * credentials.ts — Wave 94: Trust Credential API Routes
 *
 * POST /api/credentials/issue    — Issue a signed verifiable credential
 * POST /api/credentials/verify   — Verify a credential
 * GET  /api/credentials/:id      — Retrieve a credential by ID
 */

import type { Express, Request, Response } from 'express';
import { issueCredential } from '../services/credentials/credentialIssuer';
import { verifyCredential } from '../services/credentials/credentialVerifier';
import {
  storeCredential,
  getCredential,
} from '../services/credentials/credentialWallet';
import type { IssueCredentialRequest } from '../services/credentials/credentialModel';
import { log } from '../obs/logger';

// ── Dev/demo signing key (replace with KMS in production) ─────────────
// Generated with: node -e "require('crypto').generateKeyPairSync('ec',{namedCurve:'P-256'})"
// Env var: CREDENTIAL_SIGNING_KEY_PEM (PKCS#8 PEM)
const DEV_SIGNING_KEY_PEM = process.env.CREDENTIAL_SIGNING_KEY_PEM ?? '';

export function registerCredentialRoutes(app: Express): void {

  // ── POST /api/credentials/issue ─────────────────────────────────────
  app.post('/api/credentials/issue', async (req: Request, res: Response) => {
    try {
      const { issuer, subject, claims, expiresAt } = req.body ?? {};

      if (!issuer || typeof issuer !== 'string') {
        res.status(400).json({ error: 'issuer is required' });
        return;
      }
      if (!subject || typeof subject !== 'string') {
        res.status(400).json({ error: 'subject is required' });
        return;
      }
      if (!claims || typeof claims !== 'object') {
        res.status(400).json({ error: 'claims must be an object' });
        return;
      }

      const signingKey = DEV_SIGNING_KEY_PEM;
      if (!signingKey) {
        res.status(503).json({
          error: 'Credential signing key not configured',
          hint: 'Set CREDENTIAL_SIGNING_KEY_PEM environment variable',
        });
        return;
      }

      const request: IssueCredentialRequest = { issuer, subject, claims, expiresAt };
      const credential = await issueCredential(request, signingKey);

      // Auto-store in wallet
      storeCredential(credential);

      res.status(201).json({ credential });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_issue_failed', { error: msg });
      res.status(500).json({ error: 'Failed to issue credential', detail: msg });
    }
  });

  // ── POST /api/credentials/verify ───────────────────────────────────
  app.post('/api/credentials/verify', async (req: Request, res: Response) => {
    try {
      const { credential } = req.body ?? {};

      if (!credential || typeof credential !== 'object') {
        res.status(400).json({ error: 'credential object is required in request body' });
        return;
      }

      const result = await verifyCredential(credential);
      res.status(200).json({ result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_verify_failed', { error: msg });
      res.status(500).json({ error: 'Verification failed', detail: msg });
    }
  });

  // ── GET /api/credentials/:id ───────────────────────────────────────
  app.get('/api/credentials/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const credential = getCredential(id);

      if (!credential) {
        res.status(404).json({ error: `Credential ${id} not found` });
        return;
      }

      res.status(200).json({ credential });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'credential_get_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve credential', detail: msg });
    }
  });
}
