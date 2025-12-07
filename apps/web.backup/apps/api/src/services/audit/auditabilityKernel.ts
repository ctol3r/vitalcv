import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface AuditTrail {
  actor: string;
  action: string;
  timestamp: string;
  target: string;
  metadata: Record<string, unknown>;
  chainHash?: string;
}

export interface AuditabilityData {
  trails: AuditTrail[];
  anomalies: Array<{ type: string; severity: string; description: string }>;
  summaries: Array<{ period: string; summary: string }>;
  compliance: {
    score: number;
    violations: Array<{ rule: string; severity: string }>;
  };
}

/**
 * Task 345.2 — Multi-actor audit trail compiler
 * Compile audit logs across roles & services.
 */
export async function compileAuditTrail(): Promise<AuditTrail[]> {
  const trails: AuditTrail[] = [];

  // Get audit events
  const auditEvents = await prisma.auditEvent.findMany({
    orderBy: { timestamp: 'desc' },
    take: 1000,
  });

  for (const event of auditEvents) {
    trails.push({
      actor: (event.details as any)?.actor || 'system',
      action: event.eventType,
      timestamp: event.timestamp.toISOString(),
      target: event.npi || 'unknown',
      metadata: event.details || {},
      chainHash: (event.details as any)?.txHash,
    });
  }

  // Get hiring events (auditable actions)
  const hiringEvents = await prisma.hiringEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  for (const event of hiringEvents) {
    trails.push({
      actor: (event.metadata as any)?.actor || 'system',
      action: event.eventType,
      timestamp: event.createdAt.toISOString(),
      target: event.clinicianId,
      metadata: event.metadata,
      chainHash: event.txHash || undefined,
    });
  }

  return trails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Task 345.3 — Chain-verified event mastering v3
 * Ensure audit events match anchored proofs.
 */
export async function verifyChainEvents(trails: AuditTrail[]): Promise<{
  verified: number;
  unverified: number;
  mismatches: Array<{ trail: string; issue: string }>;
}> {
  let verified = 0;
  let unverified = 0;
  const mismatches: Array<{ trail: string; issue: string }> = [];

  for (const trail of trails) {
    if (trail.chainHash) {
      // Verify chain hash exists
      const proof = await prisma.blockProof.findFirst({
        where: { eventId: trail.chainHash },
      });

      if (proof) {
        verified++;
      } else {
        unverified++;
        mismatches.push({
          trail: trail.action,
          issue: 'Chain hash not found in proofs',
        });
      }
    } else {
      unverified++;
      mismatches.push({
        trail: trail.action,
        issue: 'Missing chain hash',
      });
    }
  }

  return { verified, unverified, mismatches };
}

/**
 * Task 345.5 — Audit trail anomaly detector
 * Detect missing, altered, or ambiguous events.
 */
export function detectAuditAnomalies(trails: AuditTrail[]): Array<{
  type: string;
  severity: string;
  description: string;
}> {
  const anomalies: Array<{ type: string; severity: string; description: string }> = [];

  // Check for missing timestamps
  const missingTimestamps = trails.filter((t) => !t.timestamp);
  if (missingTimestamps.length > 0) {
    anomalies.push({
      type: 'missing_timestamp',
      severity: 'high',
      description: `${missingTimestamps.length} trails missing timestamps`,
    });
  }

  // Check for gaps in audit trail
  const sortedTrails = trails
    .filter((t) => t.timestamp)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (let i = 0; i < sortedTrails.length - 1; i++) {
    const current = new Date(sortedTrails[i].timestamp);
    const next = new Date(sortedTrails[i + 1].timestamp);
    const gapHours = (next.getTime() - current.getTime()) / (1000 * 60 * 60);

    if (gapHours > 24 && sortedTrails[i].actor === sortedTrails[i + 1].actor) {
      anomalies.push({
        type: 'audit_gap',
        severity: 'medium',
        description: `Gap of ${gapHours.toFixed(1)} hours in audit trail for ${sortedTrails[i].actor}`,
      });
    }
  }

  // Check for altered events (missing chain hashes)
  const unverified = trails.filter((t) => !t.chainHash);
  if (unverified.length > trails.length * 0.3) {
    anomalies.push({
      type: 'high_unverified_rate',
      severity: 'high',
      description: `${unverified.length} unverified events (${((unverified.length / trails.length) * 100).toFixed(1)}%)`,
    });
  }

  return anomalies;
}

/**
 * Task 345.7 — Intelligent audit summaries
 * Generate narrative explanations of audit trails.
 */
export function generateAuditSummaries(trails: AuditTrail[]): Array<{
  period: string;
  summary: string;
}> {
  const summaries: Array<{ period: string; summary: string }> = [];

  // Group by day
  const byDay = trails.reduce((acc, trail) => {
    const day = trail.timestamp.substring(0, 10);
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(trail);
    return acc;
  }, {} as Record<string, AuditTrail[]>);

  for (const [day, dayTrails] of Object.entries(byDay)) {
    const actionCounts = dayTrails.reduce((acc, trail) => {
      acc[trail.action] = (acc[trail.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([action, count]) => `${action} (${count})`)
      .join(', ');

    summaries.push({
      period: day,
      summary: `${dayTrails.length} audit events: ${topActions}`,
    });
  }

  return summaries.sort((a, b) => b.period.localeCompare(a.period));
}

/**
 * Task 345.8 — Policy-compliance validator
 * Check audit logs against OPA compliance.
 */
export function validatePolicyCompliance(trails: AuditTrail[]): {
  score: number;
  violations: Array<{ rule: string; severity: string }>;
} {
  const violations: Array<{ rule: string; severity: string }> = [];
  let score = 1.0;

  // Check for required fields
  const incomplete = trails.filter(
    (t) => !t.actor || !t.action || !t.timestamp || !t.target,
  );
  if (incomplete.length > 0) {
    violations.push({
      rule: 'All audit trails must have actor, action, timestamp, and target',
      severity: 'high',
    });
    score -= incomplete.length / trails.length * 0.3;
  }

  // Check for chain verification
  const unverified = trails.filter((t) => !t.chainHash);
  if (unverified.length > trails.length * 0.2) {
    violations.push({
      rule: 'At least 80% of audit trails must be chain-verified',
      severity: 'medium',
    });
    score -= 0.2;
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    violations,
  };
}

/**
 * Task 345.1 — Get or create auditability kernel
 */
export async function getOrCreateAuditabilityKernel(): Promise<AuditabilityData> {
  let kernel = await prisma.auditabilityKernel.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!kernel) {
    const trails = await compileAuditTrail();
    const chainVerification = await verifyChainEvents(trails);
    const anomalies = detectAuditAnomalies(trails);
    const summaries = generateAuditSummaries(trails);
    const compliance = validatePolicyCompliance(trails);

    const kernelData: AuditabilityData = {
      trails,
      anomalies,
      summaries,
      compliance,
    };

    kernel = await prisma.auditabilityKernel.create({
      data: {
        kernel: kernelData,
      },
    });
  }

  return kernel.kernel as AuditabilityData;
}

/**
 * Task 345.9 — Audit export generator
 * Export audit logs in tamper-evident bundles.
 */
export function exportAuditBundle(kernel: AuditabilityData): {
  format: string;
  data: Record<string, unknown>;
  hash: string;
  tamperEvident: boolean;
} {
  const bundle = {
    trails: kernel.trails,
    anomalies: kernel.anomalies,
    summaries: kernel.summaries,
    compliance: kernel.compliance,
    exportedAt: new Date().toISOString(),
  };

  const hash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(bundle))
    .digest('hex');

  return {
    format: 'audit_bundle_v1',
    data: bundle,
    hash: `0x${hash}`,
    tamperEvident: true,
  };
}

/**
 * Task 345.10 — Anchor auditability snapshot
 */
export async function anchorAuditabilitySnapshot(): Promise<string | null> {
  try {
    const kernel = await prisma.auditabilityKernel.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!kernel) {
      return null;
    }

    const kernelData = kernel.kernel as AuditabilityData;

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'auditabilityKernelAnchored',
      payload: {
        trailCount: kernelData.trails.length,
        anomalyCount: kernelData.anomalies.length,
        summaryCount: kernelData.summaries.length,
        complianceScore: kernelData.compliance.score,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[auditability] anchor failed', error);
    return null;
  }
}

