/**
 * Wave 2D — Monitoring Job
 *
 * Background job that re-verifies all active artifacts on a 24-hour cycle.
 *
 * Flow per artifact:
 *   1. Snapshot current state
 *   2. Re-run verification via runMonitoringCheck (adapter → source → compare)
 *   3. Snapshot post-check state
 *   4. Detect deltas via processCredentialDelta
 *   5. Persist delta entries + updated artifact (handled by engines)
 *
 * Errors in individual artifacts are isolated — one failure does not halt the sweep.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../src/graphql/prisma_client';
import { runMonitoringCheck } from '../src/services/monitoringEngine';
import {
  processCredentialDelta,
  type CredentialSnapshot,
} from '../src/services/deltaMonitoringEngine';
import { log } from '../src/obs/logger';

// ── Types ───────────────────────────────────────────────────

export type MonitoringCycleResult = {
  totalChecked: number;
  statusChanges: number;
  deltasDetected: number;
  errors: number;
  durationMs: number;
};

// ── Helpers ──────────────────────────────────────────────────

function toSnapshot(artifact: {
  id: string;
  npi: string;
  source: string;
  status: string;
  checksum: string;
  merkleRoot: string | null;
  lifecycleState: string;
  expiresAt: Date | null;
  claimHashes: unknown;
  organizationId: string | null;
}): CredentialSnapshot {
  return {
    id: artifact.id,
    npi: artifact.npi,
    source: artifact.source,
    status: artifact.status,
    checksum: artifact.checksum,
    merkleRoot: artifact.merkleRoot,
    lifecycleState: artifact.lifecycleState,
    expiresAt: artifact.expiresAt,
    claimHashes: artifact.claimHashes as Prisma.JsonValue,
    organizationId: artifact.organizationId,
  };
}

// ── Core cycle ──────────────────────────────────────────────

export async function runMonitoringCycle(): Promise<MonitoringCycleResult> {
  const startTime = Date.now();
  const result: MonitoringCycleResult = {
    totalChecked: 0,
    statusChanges: 0,
    deltasDetected: 0,
    errors: 0,
    durationMs: 0,
  };

  // Load all active artifacts that have monitoring enabled
  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      lifecycleState: 'active',
      monitoring: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  log('info', 'monitoring_cycle_started', {
    event: 'monitoring_cycle_started',
    artifactCount: artifacts.length,
  });

  for (const artifact of artifacts) {
    try {
      // 1. Snapshot pre-check state
      const previousSnapshot = toSnapshot(artifact);

      // 2. Re-run verification (updates artifact in DB)
      const checkResult = await runMonitoringCheck(
        artifact.npi,
        artifact.organizationId ?? undefined,
      );
      result.totalChecked += 1;

      if (checkResult.changed) {
        result.statusChanges += 1;
      }

      // 3. Load fresh artifact state after check
      const updatedArtifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifact.id },
      });

      if (!updatedArtifact) continue;

      // 4. Detect and persist deltas
      const currentSnapshot = toSnapshot(updatedArtifact);
      const deltaResult = await processCredentialDelta(previousSnapshot, currentSnapshot);

      if (deltaResult.deltaDetected) {
        result.deltasDetected += 1;
      }
    } catch (error) {
      result.errors += 1;
      log('error', 'monitoring_cycle_artifact_error', {
        event: 'monitoring_cycle_artifact_error',
        artifactId: artifact.id,
        npi: artifact.npi,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  result.durationMs = Date.now() - startTime;

  log('info', 'monitoring_cycle_completed', {
    event: 'monitoring_cycle_completed',
    ...result,
  });

  return result;
}
