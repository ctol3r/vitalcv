import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { queryNursysLicense, computeArtifactChecksum } from './nursysAdapter';
import type { NursysFetcher } from './nursysAdapter';
import { computeTrustState } from './trustState';

const MONITORING_THRESHOLD_DAYS = 90;

type ArtifactRecord = {
  id: string;
  npi: string;
  source: string;
  status: string;
  rawPayload: Prisma.JsonValue;
  checksum: string;
  verifiedAt: Date;
  expiresAt: Date | null;
  monitoring: boolean;
  trustState: string;
  createdAt: Date;
};

type GenerateAuditBundleOptions = {
  organizationId?: string;
};


/**
 * Create a VerificationArtifact from a Nursys license query.
 * Computes SHA-256 checksum over the raw payload for tamper evidence.
 * Sets monitoring=true when license expires within 90 days.
 */
export async function createArtifactFromNursys(
  npi: string,
  fetcher?: NursysFetcher,
): Promise<ArtifactRecord> {
  const result = await queryNursysLicense(npi, fetcher);

  const checksum = computeArtifactChecksum(result);
  const verifiedAt = new Date();

  const expiresAt = result.expirationDate ? new Date(result.expirationDate) : null;
  const monitoring = shouldMonitor(expiresAt);
  const trustState = computeTrustState({ status: result.licenseStatus, expiresAt, monitoring });

  const artifact = await prisma.verificationArtifact.create({
    data: {
      npi,
      source: 'NURSYS',
      status: result.licenseStatus,
      rawPayload: result as unknown as Prisma.InputJsonValue,
      checksum,
      verifiedAt,
      expiresAt,
      monitoring,
      trustState,
    },
  });

  return artifact;
}

/**
 * Get the most recent artifact for a given NPI.
 */
export async function getLatestArtifact(npi: string): Promise<ArtifactRecord | null> {
  return prisma.verificationArtifact.findFirst({
    where: { npi },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Generate an NCQA-aligned audit bundle for a given NPI.
 * Creates an AuditSnapshot to freeze the bundle state at generation time.
 */
export async function generateAuditBundle(
  npi: string,
  options: GenerateAuditBundleOptions = {},
): Promise<{
  npi: string;
  artifact: ArtifactRecord;
  auditMetadata: {
    source: string;
    timestamp: string;
    verifierIdentity: string;
    checksum: string;
    methodology: string;
    monitoringStatus: string;
  };
  snapshotId: string;
}> {
  let artifact = await getLatestArtifact(npi);

  if (!artifact) {
    artifact = await createArtifactFromNursys(npi);
  }

  const timestamp = new Date().toISOString();
  const verifierIdentity = 'VitalCV Cross-Check Engine v1';
  const methodology = 'Primary source verification via Nursys E-Notify simulation';
  const monitoringStatus = artifact.monitoring ? 'ACTIVE_MONITORING' : 'STANDARD';

  const bundlePayload = {
    npi,
    artifact: {
      id: artifact.id,
      source: artifact.source,
      status: artifact.status,
      checksum: artifact.checksum,
      verifiedAt: artifact.verifiedAt.toISOString(),
      expiresAt: artifact.expiresAt?.toISOString() ?? null,
      monitoring: artifact.monitoring,
    },
    auditMetadata: {
      source: artifact.source,
      timestamp,
      verifierIdentity,
      checksum: artifact.checksum,
      methodology,
      monitoringStatus,
    },
  };

  // Persist snapshot at bundle generation time
  const snapshot = await prisma.auditSnapshot.create({
    data: {
      artifactId: artifact.id,
      snapshot: bundlePayload as unknown as Prisma.InputJsonValue,
    },
  });

  // Emit audit event for bundle generation
  await prisma.auditEvent.create({
    data: {
      type: 'BUNDLE_GENERATED',
      hash: computeArtifactChecksum(bundlePayload),
      clinicianId: npi,
      referenceId: artifact.id,
      metadata: {
        snapshotId: snapshot.id,
        checksum: artifact.checksum,
        monitoring: artifact.monitoring,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  if (options.organizationId) {
    await incrementPilotPlanBundleCount(options.organizationId);
  }

  return {
    npi,
    artifact,
    auditMetadata: {
      source: artifact.source,
      timestamp,
      verifierIdentity,
      checksum: artifact.checksum,
      methodology,
      monitoringStatus,
    },
    snapshotId: snapshot.id,
  };
}

async function incrementPilotPlanBundleCount(organizationId: string): Promise<void> {
  await prisma.pilotPlan.updateMany({
    where: {
      organizationId,
      active: true,
    },
    data: {
      bundleCount: {
        increment: 1,
      },
    },
  });
}

function shouldMonitor(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  const now = Date.now();
  const thresholdMs = MONITORING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  return expiresAt.getTime() - now < thresholdMs;
}
