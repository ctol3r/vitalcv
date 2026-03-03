/**
 * hitl.ts — Wave 47: Human-in-the-Loop Review Queue
 *
 * When AI confidence < 95% or board discrepancy detected,
 * the pipeline routes to this review queue for human decision.
 *
 * Endpoints
 * ─────────
 * GET  /api/hitl/queue                        — list pending reviews
 * POST /api/hitl/review/:capsuleId/approve    — admin approves
 * POST /api/hitl/review/:capsuleId/reject     — admin rejects with reason
 *
 * HITL state is tracked via AuditEvent records:
 *   AI_HITL_ESCALATION → pending
 *   AI_HITL_APPROVED   → resolved (approved)
 *   AI_HITL_REJECTED   → resolved (rejected)
 */

import type { Express, Request, Response } from 'express';
import prisma, { Prisma } from '../graphql/prisma_client';
import { sha256Hex } from '../utils/deterministic';
import { log } from '../obs/logger';
// ── Types ─────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReviewApproveBody {
  reviewerNote?: string;
}

interface ReviewRejectBody {
  reason: string;
  reviewerNote?: string;
}

interface EscalationMetadata {
  capsuleId: string;
  npi: string;
  decision: string;
  reasoning: string[];
  confidence: number;
  discrepancies: unknown[];
  status: string;
}

// ── Route registration ────────────────────────────────────────────────────

export function registerHitlRoutes(app: Express): void {
  /**
   * GET /api/hitl/queue
   * Returns pending HITL escalation items not yet resolved.
   */
  app.get('/api/hitl/queue', async (_req: Request, res: Response) => {
    try {
      // Fetch all escalation events
      const escalations = await prisma.auditEvent.findMany({
        where: { type: 'AI_HITL_ESCALATION' },
        orderBy: { createdAt: 'desc' },
      });

      // Fetch all resolution events (approved or rejected)
      const resolutions = await prisma.auditEvent.findMany({
        where: { type: { in: ['AI_HITL_APPROVED', 'AI_HITL_REJECTED'] } },
        select: { referenceId: true },
      });

      const resolvedCapsuleIds = new Set(
        resolutions.map((r) => r.referenceId).filter(Boolean),
      );

      // Filter to only pending (unresolved) escalations
      const pending = escalations.filter(
        (e) => e.referenceId && !resolvedCapsuleIds.has(e.referenceId),
      );

      log('info', 'hitl_queue_fetched', {
        totalEscalations: escalations.length,
        resolvedCount: resolvedCapsuleIds.size,
        pendingCount: pending.length,
      });

      return res.status(200).json({
        ok: true,
        pendingCount: pending.length,
        items: pending.map((e) => {
          const meta = e.metadata as unknown as EscalationMetadata | null;
          return {
            capsuleId: e.referenceId,
            npi: meta?.npi ?? null,
            confidence: meta?.confidence ?? null,
            reasoning: meta?.reasoning ?? [],
            discrepancies: meta?.discrepancies ?? [],
            escalatedAt: e.createdAt.toISOString(),
          };
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', 'hitl_queue_error', { error: message });
      return res.status(500).json({
        error: 'internal_error',
        error_description: 'Failed to fetch HITL queue.',
      });
    }
  });

  /**
   * POST /api/hitl/review/:capsuleId/approve
   * Admin approves a pending HITL item — triggers credential mint.
   */
  app.post(
    '/api/hitl/review/:capsuleId/approve',
    async (req: Request, res: Response) => {
      const { capsuleId } = req.params;
      const { reviewerNote } = req.body as ReviewApproveBody;

      if (!capsuleId || !UUID_RE.test(capsuleId)) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'capsuleId must be a valid UUID.',
        });
      }

      try {
        // Verify escalation exists and is pending
        const escalation = await prisma.auditEvent.findFirst({
          where: { type: 'AI_HITL_ESCALATION', referenceId: capsuleId },
        });

        if (!escalation) {
          return res.status(404).json({
            error: 'not_found',
            error_description: `No pending HITL escalation found for capsuleId ${capsuleId}.`,
          });
        }

        // Check not already resolved
        const existing = await prisma.auditEvent.findFirst({
          where: {
            type: { in: ['AI_HITL_APPROVED', 'AI_HITL_REJECTED'] },
            referenceId: capsuleId,
          },
        });

        if (existing) {
          return res.status(409).json({
            error: 'already_resolved',
            error_description: `HITL item ${capsuleId} was already resolved (${existing.type}).`,
          });
        }

        const meta = escalation.metadata as unknown as EscalationMetadata | null;
        const npi = meta?.npi ?? '';

        // Record the approval
        await prisma.auditEvent.create({
          data: {
            type: 'AI_HITL_APPROVED',
            hash: sha256Hex(`hitl_approved:${capsuleId}`),
            referenceId: capsuleId,
            clinicianId: npi || null,
            metadata: {
              capsuleId,
              npi,
              reviewerNote: reviewerNote ?? null,
              approvedAt: new Date().toISOString(),
            } as unknown as Prisma.InputJsonValue,
            anchored: false,
          },
        });

        // Mint a VerificationArtifact for the approved credential
        if (npi) {
          await prisma.verificationArtifact.create({
            data: {
              npi,
              source: 'AI_HITL_APPROVED',
              status: 'ACTIVE',
              rawPayload: meta as unknown as Prisma.InputJsonValue,
              checksum: sha256Hex(`hitl_artifact:${capsuleId}`),
              merkleRoot: sha256Hex(`hitl_artifact:${capsuleId}`),
              lifecycleState: 'active',
              trustState: 'verified',
              verifiedAt: new Date(),
            },
          });
        }

        log('info', 'hitl_review_approved', { capsuleId, npi, reviewerNote });

        return res.status(200).json({
          ok: true,
          capsuleId,
          decision: 'APPROVED',
          npi,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log('error', 'hitl_approve_error', { capsuleId, error: message });
        return res.status(500).json({
          error: 'internal_error',
          error_description: 'Failed to approve HITL item.',
        });
      }
    },
  );

  /**
   * POST /api/hitl/review/:capsuleId/reject
   * Admin rejects a pending HITL item with a reason.
   */
  app.post(
    '/api/hitl/review/:capsuleId/reject',
    async (req: Request, res: Response) => {
      const { capsuleId } = req.params;
      const { reason, reviewerNote } = req.body as ReviewRejectBody;

      if (!capsuleId || !UUID_RE.test(capsuleId)) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'capsuleId must be a valid UUID.',
        });
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'reason is required for rejection.',
        });
      }

      try {
        // Verify escalation exists
        const escalation = await prisma.auditEvent.findFirst({
          where: { type: 'AI_HITL_ESCALATION', referenceId: capsuleId },
        });

        if (!escalation) {
          return res.status(404).json({
            error: 'not_found',
            error_description: `No pending HITL escalation found for capsuleId ${capsuleId}.`,
          });
        }

        // Check not already resolved
        const existing = await prisma.auditEvent.findFirst({
          where: {
            type: { in: ['AI_HITL_APPROVED', 'AI_HITL_REJECTED'] },
            referenceId: capsuleId,
          },
        });

        if (existing) {
          return res.status(409).json({
            error: 'already_resolved',
            error_description: `HITL item ${capsuleId} was already resolved (${existing.type}).`,
          });
        }

        const meta = escalation.metadata as unknown as EscalationMetadata | null;
        const npi = meta?.npi ?? '';

        // Record the rejection
        await prisma.auditEvent.create({
          data: {
            type: 'AI_HITL_REJECTED',
            hash: sha256Hex(`hitl_rejected:${capsuleId}`),
            referenceId: capsuleId,
            clinicianId: npi || null,
            metadata: {
              capsuleId,
              npi,
              reason: reason.trim(),
              reviewerNote: reviewerNote ?? null,
              rejectedAt: new Date().toISOString(),
            } as unknown as Prisma.InputJsonValue,
            anchored: false,
          },
        });

        log('info', 'hitl_review_rejected', { capsuleId, npi, reason: reason.trim() });

        return res.status(200).json({
          ok: true,
          capsuleId,
          decision: 'REJECTED',
          reason: reason.trim(),
          npi,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log('error', 'hitl_reject_error', { capsuleId, error: message });
        return res.status(500).json({
          error: 'internal_error',
          error_description: 'Failed to reject HITL item.',
        });
      }
    },
  );
}
