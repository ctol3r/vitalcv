/**
 * replayRuns.ts — Replay Persistence Query Endpoint
 *
 * GET /api/replay/runs/:runId
 *
 * Looks up a SourceRun (or IngestRun) by runId or id.
 * Used by the web frontend's getReplayInspection to hydrate
 * replay data from the database instead of synthetic generation.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerReplayRunRoutes(app: Express): void {
  /**
   * GET /api/replay/runs/:runId
   *
   * Look up a run by:
   *   1. SourceRun.runId (8-char hex derived ID)
   *   2. SourceRun.id (UUID)
   *   3. IngestRun.id (UUID fallback)
   *
   * Returns a minimal run descriptor for the replay inspector.
   */
  app.get('/api/replay/runs/:runId', async (req: Request, res: Response) => {
    const { runId } = req.params;

    if (!runId || typeof runId !== 'string' || runId.trim().length === 0) {
      res.status(400).json({ error: 'runId is required' });
      return;
    }

    try {
      // 1. Try SourceRun by runId field (8-char hex) or by UUID id
      const sourceRun = await prisma.sourceRun.findFirst({
        where: UUID_RE.test(runId)
          ? { OR: [{ runId }, { id: runId }] }
          : { runId },
        select: {
          id: true,
          runId: true,
          sourceId: true,
          subjectNpi: true,
          status: true,
          startedAt: true,
          completedAt: true,
          verificationReceiptRecords: {
            select: { receiptId: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (sourceRun) {
        const receiptId = sourceRun.verificationReceiptRecords[0]?.receiptId ?? null;
        res.json({
          runId: sourceRun.runId ?? sourceRun.id,
          npi: sourceRun.subjectNpi,
          laneId: sourceRun.sourceId,
          checkedAt: sourceRun.completedAt?.toISOString() ?? sourceRun.startedAt.toISOString(),
          status: sourceRun.status,
          tier: 'T3',
          receiptId,
          priorRunId: null,
        });
        return;
      }

      // 2. Fallback: IngestRun by UUID id
      if (UUID_RE.test(runId)) {
        const ingestRun = await prisma.ingestRun.findFirst({
          where: { id: runId },
          select: {
            id: true,
            npi: true,
            status: true,
            startedAt: true,
            completedAt: true,
          },
        });

        if (ingestRun) {
          res.json({
            runId: ingestRun.id,
            npi: ingestRun.npi,
            laneId: 'ingest',
            checkedAt: ingestRun.completedAt?.toISOString() ?? ingestRun.startedAt.toISOString(),
            status: ingestRun.status,
            tier: 'T3',
            receiptId: null,
            priorRunId: null,
          });
          return;
        }
      }

      res.status(404).json({ error: 'Run not found' });
    } catch (err) {
      log('error', 'replay_run_lookup_failed', {
        runId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
