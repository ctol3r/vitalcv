/**
 * revocation.ts — Wave 101: Credential Revocation API Routes
 *
 * POST /api/revocation/revoke         — Revoke a credential
 * GET  /api/revocation/:credentialId  — Check revocation status
 * GET  /api/revocation               — List all revocations
 */

import type { Express, Request, Response } from 'express';
import {
  revokeCredentialWithCascade,
  getRevocationEntry,
  listRevocations,
} from '../services/revocation/revocationRegistry';
import {
  updateCredentialStatus,
} from '../services/credentials/credentialWallet';
import { emitAlert } from '../services/alerts/trustAlerts';
import { getRequestOrganizationId } from '../middleware/organizationContext';
import { log } from '../obs/logger';
import { auditRevocation, newTraceId } from '../services/audit/auditLedger';
import { revokeVerificationArtifact } from '../services/credentials/credentialArtifactBridge';

export function registerRevocationRoutes(app: Express): void {

  // ── POST /api/revocation/revoke ────────────────────────────────────
  app.post('/api/revocation/revoke', async (req: Request, res: Response) => {
    try {
      const { credentialId, issuer, issuerId, reason, metadata } = req.body ?? {};
      const resolvedIssuer = typeof issuerId === 'string' && issuerId.trim().length > 0
        ? issuerId
        : issuer;

      if (!credentialId || typeof credentialId !== 'string') {
        res.status(400).json({ error: 'credentialId is required' });
        return;
      }
      if (!resolvedIssuer || typeof resolvedIssuer !== 'string') {
        res.status(400).json({ error: 'issuer is required' });
        return;
      }
      if (!reason || typeof reason !== 'string') {
        res.status(400).json({ error: 'reason is required' });
        return;
      }

      const {
        entry,
        cascadeTriggered,
        cascadeResult,
      } = await revokeCredentialWithCascade({
        credentialId,
        issuer: resolvedIssuer,
        reason,
        metadata,
      });

      updateCredentialStatus(credentialId, 'REVOKED');
      await revokeVerificationArtifact(
        credentialId,
        reason,
        new Date(entry.revokedAt),
        getRequestOrganizationId(req),
      );

      try {
        await emitAlert({
          type: 'credential_revoked',
          severity: 'CRITICAL',
          title: `Credential revoked by ${resolvedIssuer.split(':').pop()}`,
          description: `Credential ${credentialId.slice(0, 8)}… has been revoked. Reason: ${reason}`,
          credentialId,
          issuerId: resolvedIssuer,
          recommendedAction: 'Remove this credential from any active presentations and notify the affected clinician.',
        });
      } catch (error) {
        log('warn', 'revocation_alert_emit_failed', {
          credentialId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      const traceId = newTraceId();
      const auditEntry = auditRevocation({
        traceId,
        actor: resolvedIssuer,
        credentialId,
        issuer: resolvedIssuer,
        reason,
      });

      res.status(201).json({
        revocation: entry,
        credentialId: entry.credentialId,
        revoked: true,
        revokedAt: entry.revokedAt,
        reason: entry.reason,
        cascadeTriggered,
        affectedDecisions: cascadeResult?.totalAffected ?? 0,
        traceId,
        receiptHash: auditEntry.receiptHash,
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
        revokedAt: entry?.revokedAt ?? null,
        reason: entry?.reason ?? null,
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
