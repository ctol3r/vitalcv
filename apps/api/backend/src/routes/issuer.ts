/**
 * issuer.ts — Wave 38: OIDC4VCI Issuer Command Center
 *
 * POST /api/issuer/revoke
 *
 * Authoritative revocation endpoint. Flips a VerificationArtifact to the
 * REVOKED state and immediately calls propagateRevocation() — the Wave 27
 * BIDIRECTIONAL_FLAG_INVALID engine — to alert all downstream employers and
 * verifiers holding active references to the credential.
 *
 * SECURITY
 * ────────
 * • /api/issuer/* is in the apiKeyAuth allowlist in app.ts (line 416).
 * • artifactId validated as UUID before any DB access.
 * • Only status/lifecycle fields mutated; raw credential payload untouched.
 * • All mutations logged to CredentialMonitoringEvent (append-only ledger).
 */

import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { propagateCredentialLifecycleChange } from '../services/revocation/propagationEngine';

// ── Types ─────────────────────────────────────────────────────────────────

interface RevokeBody {
  artifactId: string;
  reason:     string;
  context?:   string;
  issuerId?:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Route registration ────────────────────────────────────────────────────

export function registerIssuerRoutes(app: Express): void {
  /**
   * POST /api/issuer/revoke
   * Body: { artifactId, reason, context?, issuerId? }
   */
  app.post(
    '/api/issuer/revoke',
    publicApiRateLimit,
    async (req: Request, res: Response) => {
      const { artifactId, reason, context, issuerId } = req.body as RevokeBody;

      // ── Input validation ────────────────────────────────────────────────
      if (!artifactId || !UUID_RE.test(artifactId)) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'artifactId must be a valid UUID.',
        });
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'reason is required.',
        });
      }

      // ── Resolve artifact ────────────────────────────────────────────────
      const existing = await prisma.verificationArtifact.findUnique({
        where:  { id: artifactId },
        select: { id: true, npi: true, status: true, lifecycleState: true },
      });

      if (!existing) {
        return res.status(404).json({
          error:             'not_found',
          error_description: `VerificationArtifact ${artifactId} not found.`,
        });
      }

      if (existing.lifecycleState === 'revoked' || existing.status === 'REVOKED') {
        return res.status(409).json({
          error:             'already_revoked',
          error_description: 'This credential has already been revoked.',
        });
      }

      const revokedAt = new Date();

      // ── Flip credential state ───────────────────────────────────────────
      await prisma.verificationArtifact.update({
        where: { id: artifactId },
        data: {
          status:           'REVOKED',
          lifecycleState:   'revoked',
          trustState:       'revoked',
          revokedAt,
          revocationReason: reason.trim(),
        },
      });

      // ── Append monitoring event (append-only ledger) ────────────────────
      await prisma.credentialMonitoringEvent.create({
        data: {
          id:             randomUUID(),
          artifactId,
          organizationId: issuerId ?? '00000000-0000-0000-0000-000000000000',
          eventType:      'ISSUER_REVOKED',
          createdAt:      revokedAt,
        },
      });

      // ── Propagate BIDIRECTIONAL_FLAG_INVALID ────────────────────────────
      // Non-fatal: revocation is already committed even if propagation fails.
      let propagation: Awaited<ReturnType<typeof propagateCredentialLifecycleChange>> | null = null;
      try {
        propagation = await propagateCredentialLifecycleChange({
          credentialId: artifactId,
          trigger: 'credential.revoked',
          occurredAt: revokedAt,
          reason: reason.trim(),
        });
        log('info', 'issuer_revoke_propagated', {
          artifactId,
          npi:          existing.npi,
          totalFlagged: propagation.bidirectionalFlagged,
          issuerId:     issuerId ?? 'anonymous',
        });
      } catch (err) {
        log('warn', 'issuer_revoke_propagation_failed', {
          artifactId,
          message: err instanceof Error ? err.message : String(err),
        });
      }

      log('info', 'issuer_revoke', {
        event:     'issuer_revoke',
        artifactId,
        npi:       existing.npi,
        reason:    reason.trim(),
        context:   context?.trim() ?? null,
        issuerId:  issuerId ?? 'anonymous',
        revokedAt: revokedAt.toISOString(),
      });

      return res.status(200).json({
        ok:          true,
        artifactId,
        revoked_at:  revokedAt.toISOString(),
        propagation: propagation
          ? {
              total_flagged:       propagation.bidirectionalFlagged,
              flagged_acceptances: propagation.bidirectionalAcceptancesFlagged,
              flagged_starts:      propagation.bidirectionalStartsFlagged,
              traversal_hash:      propagation.bidirectionalTraversalHash,
            }
          : null,
      });
    },
  );
}
