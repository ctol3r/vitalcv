/**
 * revocation.ts — Wave 101: Credential Revocation API Routes
 *
 * POST /api/revocation/revoke         — Revoke a credential
 * GET  /api/revocation/:credentialId  — Check revocation status
 * GET  /api/revocation               — List all revocations
 */

import type { Express, Request, Response } from 'express';
import {
  revokeCredential,
  getRevocationEntry,
  listRevocations,
  isRevoked,
} from '../services/revocation/revocationRegistry';
import {
  updateCredentialStatus,
} from '../services/credentials/credentialWallet';
import { emitAlert } from '../services/alerts/trustAlerts';
import { log } from '../obs/logger';

export function registerRevocationRoutes(app: Express): void {

  // ── POST /api/revocation/revoke ────────────────────────────────────
  app.post('/api/revocation/revoke', (req: Request, res: Response) => {
    try {
      const { credentialId, issuer, reason, metadata } = req.body ?? {};

      if (!credentialId || typeof credentialId !== 'string') {
        res.status(400).json({ error: 'credentialId is required' });
        return;
      }
      if (!issuer || typeof issuer !== 'string') {
        res.status(400).json({ error: 'issuer is required' });
        return;
      }
      if (!reason || typeof reason !== 'string') {
        res.status(400).json({ error: 'reason is required' });
        return;
      }

      const entry = revokeCredential({ credentialId, issuer, reason, metadata });

      // Update wallet status if credential is in wallet
      updateCredentialStatus(credentialId, 'REVOKED');

      // Wave 101 + 97: Emit trust alert on revocation
      emitAlert({
        type: 'credential_revoked',
        severity: 'CRITICAL',
        title: `Credential revoked by ${issuer.split(':').pop()}`,
        description: `Credential ${credentialId.slice(0, 8)}… has been revoked. Reason: ${reason}`,
        credentialId,
        issuerId: issuer,
        recommendedAction: 'Remove this credential from any active presentations and notify the affected clinician.',
      });

      res.status(201).json({
        revocation: entry,
        message: 'Credential revoked and trust alert emitted',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'revocation_failed', { error: msg });
      res.status(500).json({ error: 'Failed to revoke credential', detail: msg });
    }
  });

  // ── GET /api/revocation/:credentialId ─────────────────────────────
  app.get('/api/revocation/:credentialId', (req: Request, res: Response) => {
    try {
      const { credentialId } = req.params;
      const entry = getRevocationEntry(credentialId);

      res.status(200).json({
        credentialId,
        revoked: !!entry,
        entry: entry ?? null,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'revocation_check_failed', { error: msg });
      res.status(500).json({ error: 'Failed to check revocation', detail: msg });
    }
  });

  // ── GET /api/revocation ────────────────────────────────────────────
  app.get('/api/revocation', (req: Request, res: Response) => {
    try {
      const { issuer } = req.query;
      const revocations = listRevocations(issuer as string | undefined);

      res.status(200).json({
        revocations,
        total: revocations.length,
        retrievedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'revocation_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list revocations', detail: msg });
    }
  });
}
