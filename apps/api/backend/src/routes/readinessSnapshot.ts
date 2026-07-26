/**
 * readinessSnapshot.ts — Wave M.
 *
 * GET /api/snapshot/:id — the reuse route for a persisted readiness snapshot.
 * Served to any number of reviewers via the capability id.
 *
 * AUDIT CONTRACT: every read writes an AuditEvent before the response —
 * `snapshot.accessed` on success, `snapshot.access_denied` on fail-closed
 * reads (revoked). Unknown ids 404 without an audit row (nothing exists to
 * attribute the access to).
 *
 * Honesty: the stored content travels verbatim ("as issued"); a read-time
 * freshness overlay labels stale-beyond-SLA sources and recommends
 * re-verification. Revoked fails closed with no content.
 */

import { randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { sha256ForPayload } from '../utils/deterministic';
import { loadReadinessSnapshotForServing } from '../services/distribution/readinessSnapshotService';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requesterContext(req: Request): Record<string, unknown> {
  return {
    correlationId: req.get('x-correlation-id')?.trim()?.slice(0, 120) || randomUUID(),
    requesterOrgId: req.get('x-org-id')?.trim()?.slice(0, 120) || null,
    requesterClerkUserId: (req.headers['x-clerk-user-id'] as string | undefined)?.trim() || null,
  };
}

async function writeSnapshotAccessAudit(input: {
  type: 'snapshot.accessed' | 'snapshot.access_denied';
  snapshotId: string;
  npi: string | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        id: randomUUID(),
        type: input.type,
        hash: sha256ForPayload({
          type: input.type,
          snapshotId: input.snapshotId,
          metadata: input.metadata,
        }),
        referenceId: input.snapshotId,
        clinicianId: input.npi,
        metadata: toJsonValue(input.metadata),
      },
    });
  } catch (err) {
    // The audit row is the point of the access log — surface loudly, but a
    // read must not 500 because the audit insert hiccuped.
    log('error', 'snapshot_access_audit_failed', {
      snapshotId: input.snapshotId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function registerReadinessSnapshotRoutes(app: Express): void {
  app.get(
    '/api/snapshot/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return void res.status(404).json({ error: 'snapshot_not_found' });
      }

      const context = requesterContext(req);
      const result = await loadReadinessSnapshotForServing(id);

      if (result.outcome === 'not_found') {
        return void res.status(404).json({ error: 'snapshot_not_found' });
      }

      if (result.outcome === 'revoked') {
        await writeSnapshotAccessAudit({
          type: 'snapshot.access_denied',
          snapshotId: id,
          npi: null,
          metadata: { ...context, reason: 'revoked', revokedAt: result.revokedAt },
        });
        return void res.status(410).json({
          error: 'snapshot_revoked',
          error_description:
            'The clinician revoked this share. The snapshot fails closed and serves no content.',
        });
      }

      await writeSnapshotAccessAudit({
        type: 'snapshot.accessed',
        snapshotId: result.snapshotId,
        npi: result.npi,
        metadata: {
          ...context,
          bundleId: result.bundleId,
          contentHash: result.contentHash,
          staleSourceCount: result.freshness.staleSources.length,
          reverifyRecommended: result.freshness.reverifyRecommended,
        },
      });

      return void res.status(200).json({
        ok: true,
        snapshotId: result.snapshotId,
        npi: result.npi,
        bundleId: result.bundleId,
        issuedAt: result.issuedAt,
        contentHash: result.contentHash,
        // As issued — immutable; compare contentHash across reads.
        snapshot: result.content,
        scope: result.scope,
        // Read-time overlay — never written back to the snapshot.
        freshness: result.freshness,
        accessNote: 'Every access to this snapshot is recorded in the audit log.',
      });
    }),
  );
}
