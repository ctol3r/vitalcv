import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface BiasSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  pattern: string;
  affectedGroups: string[];
  metadata: Record<string, unknown>;
}

export interface FairnessData {
  orgId: string;
  biasSignals: BiasSignal[];
  fairnessScore: number;
  demographics: {
    accepted: Record<string, number>;
    rejected: Record<string, number>;
    total: Record<string, number>;
  };
  corrections: Array<{ action: string; priority: string }>;
  transparencyLog: Array<{ timestamp: string; decision: string; rationale: string }>;
}

/**
 * Task 343.2 — Bias signal ingestion v3
 * Detect patterns in candidate acceptance/rejection.
 */
export async function ingestBiasSignals(orgId: string): Promise<BiasSignal[]> {
  const signals: BiasSignal[] = [];

  // Get hiring events for this org
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { employerId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Group by outcome
  const accepted = hiringEvents.filter((e) => e.eventType === 'offerAccepted');
  const rejected = hiringEvents.filter((e) => e.eventType === 'rejected');

  // Check for demographic patterns (simplified - would use actual demographics)
  const acceptanceRate = accepted.length / hiringEvents.length;

  if (acceptanceRate < 0.3) {
    signals.push({
      type: 'low_acceptance_rate',
      severity: 'medium',
      pattern: 'Overall acceptance rate below 30%',
      affectedGroups: ['all'],
      metadata: { rate: acceptanceRate },
    });
  }

  // Check for specialty bias
  const specialtyGroups = hiringEvents.reduce((acc, event) => {
    const specialty = (event.metadata as any)?.specialty || 'unknown';
    if (!acc[specialty]) {
      acc[specialty] = { accepted: 0, total: 0 };
    }
    acc[specialty].total++;
    if (event.eventType === 'offerAccepted') {
      acc[specialty].accepted++;
    }
    return acc;
  }, {} as Record<string, { accepted: number; total: number }>);

  for (const [specialty, stats] of Object.entries(specialtyGroups)) {
    const rate = stats.accepted / stats.total;
    if (rate < 0.2) {
      signals.push({
        type: 'specialty_bias',
        severity: 'high',
        pattern: `Low acceptance rate for ${specialty}`,
        affectedGroups: [specialty],
        metadata: { specialty, rate },
      });
    }
  }

  return signals;
}

/**
 * Task 343.3 — Contextual fairness evaluator v2
 * Fairness across specialties, orgs, and demographics (no PHI).
 */
export async function evaluateContextualFairness(orgId: string): Promise<{
  score: number;
  breakdown: Record<string, number>;
}> {
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { employerId: orgId },
  });

  // Calculate fairness by specialty
  const specialtyFairness: Record<string, number> = {};
  const specialtyGroups = hiringEvents.reduce((acc, event) => {
    const specialty = (event.metadata as any)?.specialty || 'unknown';
    if (!acc[specialty]) {
      acc[specialty] = { accepted: 0, total: 0 };
    }
    acc[specialty].total++;
    if (event.eventType === 'offerAccepted') {
      acc[specialty].accepted++;
    }
    return acc;
  }, {} as Record<string, { accepted: number; total: number }>);

  for (const [specialty, stats] of Object.entries(specialtyGroups)) {
    specialtyFairness[specialty] = stats.accepted / stats.total;
  }

  // Overall fairness score (higher variance = lower fairness)
  const rates = Object.values(specialtyFairness);
  const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  const variance =
    rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
  const fairnessScore = Math.max(0, 1 - variance * 2); // Lower variance = higher fairness

  return {
    score: fairnessScore,
    breakdown: specialtyFairness,
  };
}

/**
 * Task 343.5 — Fairness correction engine
 * Suggest bias korrigations to fix unfair behaviors.
 */
export function generateFairnessCorrections(
  biasSignals: BiasSignal[],
  fairnessScore: number,
): Array<{ action: string; priority: string }> {
  const corrections: Array<{ action: string; priority: string }> = [];

  for (const signal of biasSignals) {
    if (signal.severity === 'high') {
      corrections.push({
        action: `Address ${signal.type} bias in ${signal.affectedGroups.join(', ')}`,
        priority: 'high',
      });
    } else if (signal.severity === 'medium') {
      corrections.push({
        action: `Review ${signal.type} patterns`,
        priority: 'medium',
      });
    }
  }

  if (fairnessScore < 0.7) {
    corrections.push({
      action: 'Implement blind review process for candidate screening',
      priority: 'high',
    });
  }

  return corrections;
}

/**
 * Task 343.6 — Fairness transparency logs
 * Document fairness-related decisions.
 */
export function logFairnessDecision(
  orgId: string,
  decision: string,
  rationale: string,
): { timestamp: string; decision: string; rationale: string } {
  return {
    timestamp: new Date().toISOString(),
    decision,
    rationale,
  };
}

/**
 * Task 343.8 — Fairness predictive alerts
 * Warn employer before biased patterns solidify.
 */
export function generatePredictiveAlerts(
  biasSignals: BiasSignal[],
  fairnessScore: number,
): Array<{ type: string; message: string; severity: string }> {
  const alerts: Array<{ type: string; message: string; severity: string }> = [];

  if (fairnessScore < 0.6) {
    alerts.push({
      type: 'low_fairness_score',
      message: 'Fairness score is below acceptable threshold',
      severity: 'high',
    });
  }

  const highSeveritySignals = biasSignals.filter((s) => s.severity === 'high');
  if (highSeveritySignals.length > 2) {
    alerts.push({
      type: 'multiple_bias_signals',
      message: `Multiple high-severity bias signals detected (${highSeveritySignals.length})`,
      severity: 'high',
    });
  }

  return alerts;
}

/**
 * Task 343.1 — Get or create fairness core
 */
export async function getOrCreateFairnessCore(orgId: string): Promise<FairnessData> {
  let fairness = await prisma.hiringFairnessCore.findUnique({
    where: { orgId },
  });

  if (!fairness) {
    const biasSignals = await ingestBiasSignals(orgId);
    const fairnessEval = await evaluateContextualFairness(orgId);
    const corrections = generateFairnessCorrections(biasSignals, fairnessEval.score);
    const transparencyLog: Array<{ timestamp: string; decision: string; rationale: string }> = [];

    // Initialize demographics (simplified - would use actual demographics)
    const hiringEvents = await prisma.hiringEvent.findMany({
      where: { employerId: orgId },
    });

    const demographics = {
      accepted: {} as Record<string, number>,
      rejected: {} as Record<string, number>,
      total: {} as Record<string, number>,
    };

    for (const event of hiringEvents) {
      const specialty = (event.metadata as any)?.specialty || 'unknown';
      demographics.total[specialty] = (demographics.total[specialty] || 0) + 1;
      if (event.eventType === 'offerAccepted') {
        demographics.accepted[specialty] = (demographics.accepted[specialty] || 0) + 1;
      } else if (event.eventType === 'rejected') {
        demographics.rejected[specialty] = (demographics.rejected[specialty] || 0) + 1;
      }
    }

    const fairnessData: FairnessData = {
      orgId,
      biasSignals,
      fairnessScore: fairnessEval.score,
      demographics,
      corrections,
      transparencyLog,
    };

    fairness = await prisma.hiringFairnessCore.create({
      data: {
        orgId,
        fairness: fairnessData,
      },
    });
  }

  return fairness.fairness as FairnessData;
}

/**
 * Task 343.9 — Fairness audit export
 * Compliance-ready fairness pack.
 */
export function exportFairnessAudit(fairness: FairnessData): {
  format: string;
  data: Record<string, unknown>;
  hash: string;
} {
  const audit = {
    orgId: fairness.orgId,
    fairnessScore: fairness.fairnessScore,
    biasSignals: fairness.biasSignals,
    demographics: fairness.demographics,
    corrections: fairness.corrections,
    transparencyLog: fairness.transparencyLog,
    exportedAt: new Date().toISOString(),
  };

  const hash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(audit))
    .digest('hex');

  return {
    format: 'fairness_audit_v1',
    data: audit,
    hash: `0x${hash}`,
  };
}

/**
 * Task 343.10 — Anchor fairness core snapshot
 */
export async function anchorFairnessSnapshot(orgId: string): Promise<string | null> {
  try {
    const fairness = await prisma.hiringFairnessCore.findUnique({
      where: { orgId },
    });

    if (!fairness) {
      return null;
    }

    const fairnessData = fairness.fairness as FairnessData;

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'hiringFairnessAnchored',
      payload: {
        orgId,
        fairnessScore: fairnessData.fairnessScore,
        biasSignalCount: fairnessData.biasSignals.length,
        correctionCount: fairnessData.corrections.length,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[fairness] anchor failed', error);
    return null;
  }
}

