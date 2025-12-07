/**
 * SupervisorSignalCollector
 *
 * Aggregates signals from various sources:
 * - Drift signals
 * - Safety signals
 * - Fusion score deltas
 * - Compliance failures
 * - Queue congestion metrics
 * - EHR sync backlog
 */

import {
  PrismaClient,
  DriftEventStatus,
  JobQueueStatus,
  EhrSynchronizationStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

export interface DriftSignals {
  openCount: number;
  criticalCount: number;
  highCount: number;
  recentCount: number; // Last 24 hours
}

export interface SafetySignals {
  activeCount: number;
  criticalCount: number;
  highCount: number;
  recentCount: number; // Last 24 hours
}

export interface FusionScoreDelta {
  clinicianId: string;
  delta: number;
  timestamp: Date;
}

export interface ComplianceFailures {
  totalFailures: number;
  recentFailures: number; // Last 24 hours
  criticalFailures: number;
}

export interface QueueCongestion {
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  oldestPendingAge: number; // milliseconds
}

export interface EhrSyncBacklog {
  pendingSyncs: number;
  failedSyncs: number;
  oldestPendingAge: number; // milliseconds
}

export interface SupervisorSignals {
  drift: DriftSignals;
  safety: SafetySignals;
  fusionDeltas: FusionScoreDelta[];
  compliance: ComplianceFailures;
  queue: QueueCongestion;
  ehrSync: EhrSyncBacklog;
  collectedAt: Date;
}

/**
 * Collect all supervisor signals
 */
export async function collectSignals(): Promise<SupervisorSignals> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [drift, safety, fusionDeltas, compliance, queue, ehrSync] =
    await Promise.all([
      collectDriftSignals(last24h),
      collectSafetySignals(last24h),
      collectFusionScoreDeltas(last24h),
      collectComplianceFailures(last24h),
      collectQueueCongestion(),
      collectEhrSyncBacklog(),
    ]);

  return {
    drift,
    safety,
    fusionDeltas,
    compliance,
    queue,
    ehrSync,
    collectedAt: now,
  };
}

/**
 * Collect drift signals
 */
async function collectDriftSignals(since: Date): Promise<DriftSignals> {
  const [all, recent] = await Promise.all([
    prisma.driftEvent.findMany({
      where: {
        status: DriftEventStatus.OPEN,
      },
    }),
    prisma.driftEvent.findMany({
      where: {
        status: DriftEventStatus.OPEN,
        detectedAt: {
          gte: since,
        },
      },
    }),
  ]);

  const criticalCount = all.filter((e) => e.severity === 'CRITICAL').length;
  const highCount = all.filter((e) => e.severity === 'HIGH').length;

  return {
    openCount: all.length,
    criticalCount,
    highCount,
    recentCount: recent.length,
  };
}

/**
 * Collect safety signals
 */
async function collectSafetySignals(since: Date): Promise<SafetySignals> {
  const [all, recent] = await Promise.all([
    prisma.privilegeSafetySignal.findMany({
      where: {
        resolvedAt: null, // Active signals
      },
    }),
    prisma.privilegeSafetySignal.findMany({
      where: {
        resolvedAt: null,
        detectedAt: {
          gte: since,
        },
      },
    }),
  ]);

  const criticalCount = all.filter((s) => s.severity === 'CRITICAL').length;
  const highCount = all.filter((s) => s.severity === 'HIGH').length;

  return {
    activeCount: all.length,
    criticalCount,
    highCount,
    recentCount: recent.length,
  };
}

/**
 * Collect fusion score deltas (simplified - would need actual fusion tracking)
 */
async function collectFusionScoreDeltas(
  since: Date
): Promise<FusionScoreDelta[]> {
  // TODO: Implement actual fusion score delta tracking
  // This is a placeholder that returns empty array
  // In production, would query fusion score history or delta log
  return [];
}

/**
 * Collect compliance failures
 */
async function collectComplianceFailures(
  since: Date
): Promise<ComplianceFailures> {
  // TODO: Implement actual compliance failure tracking
  // This is a placeholder
  // In production, would query compliance check results
  return {
    totalFailures: 0,
    recentFailures: 0,
    criticalFailures: 0,
  };
}

/**
 * Collect queue congestion metrics
 */
async function collectQueueCongestion(): Promise<QueueCongestion> {
  const [pending, running, failed] = await Promise.all([
    prisma.jobQueue.findMany({
      where: {
        status: JobQueueStatus.PENDING,
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
    prisma.jobQueue.findMany({
      where: {
        status: JobQueueStatus.RUNNING,
      },
    }),
    prisma.jobQueue.findMany({
      where: {
        status: JobQueueStatus.FAILED,
      },
    }),
  ]);

  const oldestPendingAge =
    pending.length > 0
      ? Date.now() - pending[0].createdAt.getTime()
      : 0;

  return {
    pendingJobs: pending.length,
    runningJobs: running.length,
    failedJobs: failed.length,
    oldestPendingAge,
  };
}

/**
 * Collect EHR sync backlog
 */
async function collectEhrSyncBacklog(): Promise<EhrSyncBacklog> {
  const [pending, failed] = await Promise.all([
    prisma.ehrSynchronization.findMany({
      where: {
        status: EhrSynchronizationStatus.PENDING,
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
    prisma.ehrSynchronization.findMany({
      where: {
        status: EhrSynchronizationStatus.FAILED,
      },
    }),
  ]);

  const oldestPendingAge =
    pending.length > 0
      ? Date.now() - pending[0].createdAt.getTime()
      : 0;

  return {
    pendingSyncs: pending.length,
    failedSyncs: failed.length,
    oldestPendingAge,
  };
}

