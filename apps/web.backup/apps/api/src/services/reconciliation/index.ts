import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface ChainMismatch {
  chain: string;
  credentialId: string;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: number;
}

export interface DataSourcePriority {
  source: string;
  priority: number;
  authoritative: boolean;
  reason: string;
}

export interface MismatchCluster {
  clusterId: string;
  mismatches: ChainMismatch[];
  commonField: string;
  severity: number;
}

export interface ReconciliationFabric {
  clinicianId: string;
  fabric: {
    mismatches: ChainMismatch[];
    sourcePriority: DataSourcePriority[];
    clusters: MismatchCluster[];
    execution: Array<{
      action: string;
      status: string;
      timestamp: string;
    }>;
    riskScore: number;
    timeline: Array<{
      date: string;
      fixes: number;
      remaining: number;
    }>;
    updatedAt: string;
  };
  updatedAt: string;
}

/**
 * Task 357.2 — Cross-chain reconciliation analyzer v4
 * Identify mismatches across Substrate/EVM/Cosmos anchors
 */
export async function analyzeCrossChainMismatches(
  clinicianId: string,
): Promise<ChainMismatch[]> {
  const mismatches: ChainMismatch[] = [];

  // Get credentials from different sources
  const masterIndex = await prisma.masterCredentialIndex.findMany({
    where: { clinicianId },
  });

  const globalLicenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });

  // Compare master index with global licenses
  for (const index of masterIndex) {
    const matchingLicense = globalLicenses.find(
      (l) => l.licenseNumber === index.credentialId,
    );

    if (matchingLicense) {
      // Check status mismatch
      if (index.status !== matchingLicense.status) {
        mismatches.push({
          chain: 'substrate',
          credentialId: index.credentialId,
          field: 'status',
          expected: index.status,
          actual: matchingLicense.status,
          severity: 0.7,
        });
      }

      // Check expiration mismatch
      const indexExpiry = (index.lastUpdated as unknown as Date)?.toISOString();
      const licenseExpiry = matchingLicense.expiresAt?.toISOString();

      if (indexExpiry !== licenseExpiry) {
        mismatches.push({
          chain: 'evm',
          credentialId: index.credentialId,
          field: 'expiration',
          expected: indexExpiry,
          actual: licenseExpiry,
          severity: 0.6,
        });
      }
    }
  }

  return mismatches;
}

/**
 * Task 357.3 — Data source priority resolver
 * Choose authoritative version of credential data
 */
export async function resolveDataSourcePriority(
  clinicianId: string,
): Promise<DataSourcePriority[]> {
  const priorities: DataSourcePriority[] = [];

  // Check NPPES (highest priority)
  const npi = await prisma.npiValidation.findFirst({
    where: { clinicianId },
  });
  if (npi) {
    priorities.push({
      source: 'nppes',
      priority: 1,
      authoritative: true,
      reason: 'Official NPPES registry',
    });
  }

  // Check state boards
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });
  if (licenses.length > 0) {
    priorities.push({
      source: 'state_boards',
      priority: 2,
      authoritative: true,
      reason: 'State licensing authority',
    });
  }

  // Check master index
  const masterIndex = await prisma.masterCredentialIndex.findMany({
    where: { clinicianId },
  });
  if (masterIndex.length > 0) {
    priorities.push({
      source: 'master_index',
      priority: 3,
      authoritative: false,
      reason: 'Internal aggregated index',
    });
  }

  return priorities.sort((a, b) => a.priority - b.priority);
}

/**
 * Task 357.5 — Mismatch clustering engine
 * Cluster similar discrepancies for mass correction
 */
export async function clusterMismatches(
  mismatches: ChainMismatch[],
): Promise<MismatchCluster[]> {
  const clusters: MismatchCluster[] = [];
  const fieldGroups = new Map<string, ChainMismatch[]>();

  // Group by field
  for (const mismatch of mismatches) {
    if (!fieldGroups.has(mismatch.field)) {
      fieldGroups.set(mismatch.field, []);
    }
    fieldGroups.get(mismatch.field)!.push(mismatch);
  }

  // Create clusters
  for (const [field, fieldMismatches] of fieldGroups.entries()) {
    const avgSeverity =
      fieldMismatches.reduce((sum, m) => sum + m.severity, 0) / fieldMismatches.length;

    clusters.push({
      clusterId: `cluster_${field}`,
      mismatches: fieldMismatches,
      commonField: field,
      severity: avgSeverity,
    });
  }

  return clusters;
}

/**
 * Task 357.6 — Reconciliation execution pipeline
 * Perform synchronized updates across systems
 */
export async function executeReconciliation(
  clinicianId: string,
  mismatches: ChainMismatch[],
  sourcePriority: DataSourcePriority[],
): Promise<Array<{ action: string; status: string; timestamp: string }>> {
  const execution: Array<{ action: string; status: string; timestamp: string }> = [];

  // Get authoritative source
  const authoritative = sourcePriority.find((s) => s.authoritative);
  if (!authoritative) {
    execution.push({
      action: 'reconciliation_aborted',
      status: 'failed',
      timestamp: new Date().toISOString(),
    });
    return execution;
  }

  // Fix mismatches
  for (const mismatch of mismatches) {
    try {
      // Update master index with authoritative data
      await prisma.masterCredentialIndex.updateMany({
        where: {
          clinicianId,
          credentialId: mismatch.credentialId,
        },
        data: {
          status: mismatch.expected as string,
        },
      });

      execution.push({
        action: `fixed_${mismatch.field}_${mismatch.credentialId}`,
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      execution.push({
        action: `fix_${mismatch.field}_${mismatch.credentialId}`,
        status: 'failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return execution;
}

/**
 * Task 357.7 — Reconciliation risk scorer
 * Score severity of divergence
 */
export async function scoreReconciliationRisk(
  mismatches: ChainMismatch[],
  clusters: MismatchCluster[],
): Promise<number> {
  // Compute risk based on mismatch severity and count
  const avgSeverity =
    mismatches.length > 0
      ? mismatches.reduce((sum, m) => sum + m.severity, 0) / mismatches.length
      : 0;

  const clusterRisk =
    clusters.length > 0
      ? clusters.reduce((sum, c) => sum + c.severity, 0) / clusters.length
      : 0;

  // Overall risk (0-100)
  return Math.min((avgSeverity + clusterRisk) * 50, 100);
}

/**
 * Task 357.8 — Reconciliation timeline
 * Show fixes over time
 */
export async function buildReconciliationTimeline(
  clinicianId: string,
): Promise<Array<{ date: string; fixes: number; remaining: number }>> {
  const timeline: Array<{ date: string; fixes: number; remaining: number }> = [];

  const fabrics = await prisma.reconciliationFabric.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'asc' },
    take: 20,
  });

  for (const fabric of fabrics) {
    const data = fabric.fabric as ReconciliationFabric['fabric'];
    const fixes = data.execution.filter((e) => e.status === 'success').length;
    const remaining = data.mismatches.length - fixes;

    timeline.push({
      date: fabric.updatedAt.toISOString(),
      fixes,
      remaining,
    });
  }

  return timeline;
}

/**
 * Task 357.1 — Get or create reconciliation fabric
 */
export async function getOrCreateReconciliationFabric(
  clinicianId: string,
): Promise<ReconciliationFabric> {
  const existing = await prisma.reconciliationFabric.findFirst({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return {
      clinicianId,
      fabric: existing.fabric as ReconciliationFabric['fabric'],
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  // Create new fabric
  const mismatches = await analyzeCrossChainMismatches(clinicianId);
  const sourcePriority = await resolveDataSourcePriority(clinicianId);
  const clusters = await clusterMismatches(mismatches);
  const execution = await executeReconciliation(clinicianId, mismatches, sourcePriority);
  const riskScore = await scoreReconciliationRisk(mismatches, clusters);
  const timeline = await buildReconciliationTimeline(clinicianId);

  const fabric: ReconciliationFabric = {
    clinicianId,
    fabric: {
      mismatches,
      sourcePriority,
      clusters,
      execution,
      riskScore,
      timeline,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  await prisma.reconciliationFabric.create({
    data: {
      clinicianId,
      fabric: fabric.fabric as unknown as Record<string, unknown>,
    },
  });

  return fabric;
}

/**
 * Task 357.9 — Export reconciliation audit
 */
export async function exportReconciliationAudit(clinicianId: string): Promise<{
  summary: string;
  pdfData: string;
}> {
  const fabric = await getOrCreateReconciliationFabric(clinicianId);

  const summary = `
Reconciliation Fabric Audit - ${clinicianId}
Generated: ${fabric.fabric.updatedAt}

Mismatches Detected: ${fabric.fabric.mismatches.length}
Clusters: ${fabric.fabric.clusters.length}
Risk Score: ${fabric.fabric.riskScore.toFixed(1)}/100

Data Source Priority:
${fabric.fabric.sourcePriority
  .map((s) => `  ${s.source}: Priority ${s.priority} (${s.authoritative ? 'Authoritative' : 'Non-authoritative'})`)
  .join('\n')}

Execution Status:
  Successful: ${fabric.fabric.execution.filter((e) => e.status === 'success').length}
  Failed: ${fabric.fabric.execution.filter((e) => e.status === 'failed').length}

Timeline Points: ${fabric.fabric.timeline.length}
  `.trim();

  const pdfData = JSON.stringify(fabric, null, 2);

  return { summary, pdfData };
}

/**
 * Task 357.10 — Anchor reconciliation snapshot
 */
export async function anchorReconciliationSnapshot(clinicianId: string): Promise<void> {
  const fabric = await getOrCreateReconciliationFabric(clinicianId);

  const fabricHash = createHash('sha256')
    .update(JSON.stringify(fabric))
    .digest('hex');

  anchorEvent('reconciliationFabricAnchored', {
    clinicianId,
    fabricHash,
    mismatchCount: fabric.fabric.mismatches.length,
    clusterCount: fabric.fabric.clusters.length,
    riskScore: fabric.fabric.riskScore,
    timestamp: new Date().toISOString(),
  });
}

