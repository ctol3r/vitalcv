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
          priorRunId: true,
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
          priorRunId: sourceRun.priorRunId ?? null,
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

/**
 * GET /api/replay/runs/by-npi/:npi
 *
 * Returns all SourceRun records for a given NPI, ordered startedAt ASC.
 * Includes runId + priorRunId for chain traversal.
 * Public — registered before org-context middleware.
 */
export function registerReplayByNpiRoute(app: import('express').Express): void {
  /**
   * GET /api/replay/runs/by-npi/:npi
   *
   * Returns all SourceRun records for a given NPI.
   * Newest-first ordering. Includes entityId, sourceSummary, chronologyIndex.
   * Public — no auth required.
   */
  app.get('/api/replay/runs/by-npi/:npi', async (req: import('express').Request, res: import('express').Response) => {
    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI. Must be exactly 10 digits.' });
      return;
    }

    try {
      // Resolve entity
      const entity = await prisma.vcvEntity.findFirst({
        where: { npi },
        select: { id: true, displayName: true, npiType: true },
      });

      const runs = await prisma.sourceRun.findMany({
        where: { subjectNpi: npi, runId: { not: null } },
        orderBy: [{ startedAt: 'desc' }],  // newest-first
        select: {
          runId: true,
          priorRunId: true,
          sourceId: true,
          subjectNpi: true,
          status: true,
          startedAt: true,
          completedAt: true,
          verificationReceiptRecords: {
            select: { receiptId: true, trustTier: true, sourceSystem: true },
            take: 3,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Chronology index: oldest=0, newest=N-1 (compute from startedAt ascending)
      const sorted = [...runs].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      const chronoMap = new Map<string, number>();
      sorted.forEach((r, i) => { if (r.runId) chronoMap.set(r.runId, i); });

      const enrichedRuns = runs.map((run) => ({
        runId: run.runId,
        priorRunId: run.priorRunId,
        lineageKey: `${run.sourceId}:${run.subjectNpi}`,
        checkedAt: (run.completedAt ?? run.startedAt).toISOString(),
        createdAt: run.startedAt.toISOString(),
        status: run.status,
        sourceSummary: run.verificationReceiptRecords.map((r) => ({
          receiptId: r.receiptId,
          trustTier: r.trustTier,
          sourceSystem: r.sourceSystem,
        })),
        chronologyIndex: run.runId ? (chronoMap.get(run.runId) ?? 0) : 0,
      }));

      res.json({
        npi,
        entityId: entity?.id ?? null,
        displayName: entity?.displayName ?? null,
        totalRuns: enrichedRuns.length,
        chainedRuns: enrichedRuns.filter((r) => r.priorRunId !== null).length,
        headRunId: sorted[sorted.length - 1]?.runId ?? null,
        originRunId: sorted[0]?.runId ?? null,
        runs: enrichedRuns,
        reconstructedAt: new Date().toISOString(),
      });
    } catch (e) {
      log('error', 'replay_by_npi_failed', { npi, error: String(e) });
      res.status(500).json({ error: 'Internal error' });
    }
  });

  /**
   * GET /api/replay/chain/:npi
   *
   * Continuity summary — grouped by lineageKey (sourceId:npi).
   * Returns per-lineage continuity state, history count, and latest/first timestamps.
   * Public — no auth required.
   */
  app.get('/api/replay/chain/:npi', async (req: import('express').Request, res: import('express').Response) => {
    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI. Must be exactly 10 digits.' });
      return;
    }

    try {
      const entity = await prisma.vcvEntity.findFirst({
        where: { npi },
        select: { id: true, displayName: true },
      });

      const runs = await prisma.sourceRun.findMany({
        where: { subjectNpi: npi, runId: { not: null } },
        orderBy: { startedAt: 'asc' },
        select: {
          runId: true,
          priorRunId: true,
          sourceId: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      });

      // Group by sourceId (= lineageKey prefix)
      const groups: Record<string, typeof runs> = {};
      for (const run of runs) {
        const key = `${run.sourceId}:${npi}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(run);
      }

      const lineages = Object.entries(groups).map(([lineageKey, lineageRuns]) => {
        const first = lineageRuns[0];
        const last = lineageRuns[lineageRuns.length - 1];
        const chainedCount = lineageRuns.filter((r) => r.priorRunId !== null).length;

        // continuityState:
        // stable = all runs chained correctly (chainedCount === runs.length - 1)
        // extended = chain exists but has gaps (some priorRunId null on non-origin runs)
        // diverged = unexpected status patterns or orphaned runs
        let continuityState: 'stable' | 'extended' | 'diverged' = 'stable';
        if (lineageRuns.length > 1 && chainedCount < lineageRuns.length - 1) {
          continuityState = 'extended';
        }
        const hasOrphan = lineageRuns.some(
          (r, i) => i > 0 && r.priorRunId !== null &&
            !lineageRuns.some((prev) => prev.runId === r.priorRunId),
        );
        if (hasOrphan) continuityState = 'diverged';

        return {
          lineageKey,
          historyCount: lineageRuns.length,
          latestRunId: last?.runId ?? null,
          latestCheckedAt: (last?.completedAt ?? last?.startedAt)?.toISOString() ?? null,
          continuityState,
          firstObservedAt: first?.startedAt?.toISOString() ?? null,
          lastObservedAt: (last?.completedAt ?? last?.startedAt)?.toISOString() ?? null,
        };
      });

      res.json({
        npi,
        entityId: entity?.id ?? null,
        displayName: entity?.displayName ?? null,
        lineages,
        totalRuns: runs.length,
        reconstructedAt: new Date().toISOString(),
      });
    } catch (e) {
      log('error', 'replay_chain_failed', { npi, error: String(e) });
      res.status(500).json({ error: 'Internal error' });
    }
  });
}
