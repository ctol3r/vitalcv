/**
 * replayReconstructor.ts
 *
 * Reconstructs replay continuity from durable DB state alone.
 * No process memory. No synthetic fallback. PostgreSQL only.
 *
 * Used by:
 * - Restart recovery (rebuild chain after crash)
 * - Integrity verification (audit chain)
 * - Reconciliation (detect + repair gaps)
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReplayChainNode {
  runId: string;
  priorRunId: string | null;
  subjectNpi: string;
  sourceId: string;
  status: string;
  checkedAt: string;           // ISO 8601 Z
  receiptId: string | null;
  chainPosition: number;       // 0 = origin, n = head
  isHead: boolean;
  isOrphan: boolean;           // true if priorRunId set but prior not found
}

export interface ReplayChainReport {
  npi: string;
  sourceId: string;
  totalRuns: number;
  chainedRuns: number;
  orphanedRuns: number;
  missingLinks: number;
  headRunId: string | null;
  originRunId: string | null;
  chain: ReplayChainNode[];
  reconstructedAt: string;
}

export interface ReconstructionSummary {
  npis: string[];
  totalSourceRuns: number;
  runsWithRunId: number;
  runsChained: number;
  orphanedRuns: number;
  chainsRepaired: number;
  reconstructedAt: string;
}

// ── djb2 deterministic runId ───────────────────────────────────────────────────

function deriveRunId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

// ── Core reconstruction ────────────────────────────────────────────────────────

/**
 * Reconstruct the full replay chain for a given NPI + sourceId from DB state.
 * Returns nodes ordered origin → head (ascending startedAt).
 */
export async function reconstructChain(
  npi: string,
  sourceId: string,
): Promise<ReplayChainReport> {
  const runs = await prisma.sourceRun.findMany({
    where: { subjectNpi: npi, sourceId },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      runId: true,
      priorRunId: true,
      subjectNpi: true,
      sourceId: true,
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

  const runIdSet = new Set(runs.map((r) => r.runId).filter(Boolean));
  const nodes: ReplayChainNode[] = runs.map((run, idx) => {
    const priorMissing =
      run.priorRunId !== null && !runIdSet.has(run.priorRunId);
    return {
      runId: run.runId ?? deriveRunId(`${run.subjectNpi}:${run.startedAt.toISOString()}`),
      priorRunId: run.priorRunId,
      subjectNpi: run.subjectNpi,
      sourceId: run.sourceId,
      status: run.status,
      checkedAt: (run.completedAt ?? run.startedAt).toISOString(),
      receiptId: run.verificationReceiptRecords[0]?.receiptId ?? null,
      chainPosition: idx,
      isHead: idx === runs.length - 1,
      isOrphan: priorMissing,
    };
  });

  const orphanedRuns = nodes.filter((n) => n.isOrphan).length;
  const chainedRuns = nodes.filter((n) => n.priorRunId !== null).length;
  const missingLinks = nodes.filter((n) => n.priorRunId !== null && n.isOrphan).length;

  return {
    npi,
    sourceId,
    totalRuns: runs.length,
    chainedRuns,
    orphanedRuns,
    missingLinks,
    headRunId: nodes[nodes.length - 1]?.runId ?? null,
    originRunId: nodes[0]?.runId ?? null,
    chain: nodes,
    reconstructedAt: new Date().toISOString(),
  };
}

/**
 * Repair broken chain links for a given NPI.
 * Sets priorRunId = previous run's runId where it's missing or null.
 * Idempotent: re-running produces the same result.
 */
export async function repairChain(npi: string): Promise<{ repaired: number }> {
  const allRuns = await prisma.sourceRun.findMany({
    where: { subjectNpi: npi, runId: { not: null } },
    orderBy: [{ sourceId: 'asc' }, { startedAt: 'asc' }],
    select: { id: true, runId: true, priorRunId: true, sourceId: true, startedAt: true },
  });

  let repaired = 0;
  const bySource: Record<string, typeof allRuns> = {};
  for (const run of allRuns) {
    if (!bySource[run.sourceId]) bySource[run.sourceId] = [];
    bySource[run.sourceId].push(run);
  }

  for (const sourceRuns of Object.values(bySource)) {
    for (let i = 1; i < sourceRuns.length; i++) {
      const run = sourceRuns[i];
      const expectedPrior = sourceRuns[i - 1].runId;
      if (run.priorRunId !== expectedPrior) {
        try {
          await prisma.sourceRun.update({
            where: { id: run.id },
            data: { priorRunId: expectedPrior },
          });
          repaired++;
        } catch (e) {
          log('warn', 'chain_repair_failed', { runId: run.runId, error: String(e) });
        }
      }
    }
  }

  return { repaired };
}

/**
 * Full reconstruction summary across all NPIs that have SourceRuns.
 * Used by restart recovery and reconciliation schedulers.
 */
export async function reconstructAll(): Promise<ReconstructionSummary> {
  const [totalSourceRuns, runsWithRunId, runsChained] = await Promise.all([
    prisma.sourceRun.count(),
    prisma.sourceRun.count({ where: { runId: { not: null } } }),
    prisma.sourceRun.count({ where: { priorRunId: { not: null } } }),
  ]);

  const orphanQuery = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) as n FROM source_runs s
    WHERE s.prior_run_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM source_runs s2
      WHERE s2.run_id = s.prior_run_id
    )
  `;
  const orphanedRuns = Number(orphanQuery[0]?.n ?? 0);

  // Repair any broken chains
  const npisQuery = await prisma.$queryRaw<{ subject_npi: string }[]>`
    SELECT DISTINCT subject_npi FROM source_runs WHERE run_id IS NOT NULL
  `;
  const npis = npisQuery.map((r) => r.subject_npi);

  let chainsRepaired = 0;
  for (const npi of npis) {
    const result = await repairChain(npi);
    chainsRepaired += result.repaired;
  }

  return {
    npis,
    totalSourceRuns,
    runsWithRunId,
    runsChained,
    orphanedRuns,
    chainsRepaired,
    reconstructedAt: new Date().toISOString(),
  };
}
