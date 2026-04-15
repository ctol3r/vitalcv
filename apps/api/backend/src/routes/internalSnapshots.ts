/**
 * internalSnapshots.ts — GET /api/internal/snapshots/:id
 *
 * Read-through for a single DecisionAttestation row by id. Operators
 * use this to see the full snapshot (evidence / coverage / trust
 * signals / captured-at time / hash / actor / org) EXACTLY as it was
 * written at decision time. NO recompute, NO mutation.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

export function registerInternalSnapshotRoutes(app: Express): void {
  app.get('/api/internal/snapshots/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length < 8) {
      return res.status(400).json({
        error: 'invalid_id',
        error_description: 'snapshot id is required.',
      });
    }

    try {
      const row = await prisma.decisionAttestation.findUnique({
        where: { id },
        select: {
          id: true,
          clinicianNpi: true,
          actionTaken: true,
          decisionState: true,
          decisionTimestamp: true,
          snapshot: true,
          hash: true,
          actorId: true,
          organizationId: true,
          createdAt: true,
        },
      });

      if (!row) {
        return res.status(404).json({
          error: 'snapshot_not_found',
          error_description: 'No snapshot exists with that id.',
        });
      }

      log('info', 'internal_snapshot_served', {
        id: row.id,
        npi_prefix: row.clinicianNpi.slice(0, 4) + '····',
      });

      // Return the row verbatim — NO recompute, NO mutation. The
      // snapshot JSON is whatever was canonically hashed at capture.
      return res.status(200).json({
        id: row.id,
        clinicianNpi: row.clinicianNpi,
        actionTaken: row.actionTaken,
        decisionState: row.decisionState,
        decisionTimestamp: row.decisionTimestamp.toISOString(),
        snapshot: row.snapshot,
        hash: row.hash,
        actorId: row.actorId,
        organizationId: row.organizationId,
        createdAt: row.createdAt.toISOString(),
      });
    } catch (error) {
      log('error', 'internal_snapshot_failed', {
        id,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({
        error: 'snapshot_read_failed',
        error_description: 'Could not read snapshot.',
      });
    }
  });
}
