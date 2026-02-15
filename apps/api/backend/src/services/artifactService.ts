import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import {
  VerifierLifecycle,
  assessVerifierLifecycleTransition,
  coerceVerifierLifecycle,
  isVerifierLifecycleAtLeast,
  logVerifierLifecycleTransitionEvent,
} from './verifierLifecycle';
import { log } from '../obs/logger';
import { computeArtifactChecksum } from './nursysAdapter';
import { getVerificationSource } from './sourceRegistry';
import { computeTrustState } from './trustState';
import type { ArtifactEventType } from '../types/auditEventTypes';

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
 * Create a VerificationArtifact via the adapter registry.
 * Computes SHA-256 checksum over the raw payload for tamper evidence.
 * Sets monitoring=true when license expires within 90 days.
 *
 * Wave 33: Routed through sourceRegistry to enforce adapter purity.
 */
export async function createArtifactFromNursys(
  npi: string,
  organizationId?: string,
): Promise<ArtifactRecord> {
  const source = getVerificationSource('NURSYS');
  const result = await source.verify(npi);

  const checksum = computeArtifactChecksum(result.rawPayload);
  const verifiedAt = new Date();

  const expiresAt = result.expirationDate ?? null;
  const monitoring = shouldMonitor(expiresAt);
  const trustState = computeTrustState({ status: result.licenseStatus, expiresAt, monitoring });

  const artifact = await prisma.verificationArtifact.create({
    data: {
      npi,
      source: 'NURSYS',
      status: result.licenseStatus,
      rawPayload: result.rawPayload as Prisma.InputJsonValue,
      checksum,
      verifiedAt,
      expiresAt,
      monitoring,
      trustState,
      ...(organizationId ? { organizationId } : {}),
    },
  });

  return artifact;
}

/**
 * Get the most recent artifact for a given NPI.
 * When organizationId is provided, results are scoped to that tenant.
 *
 * Wave 33: Added organizationId parameter for multi-tenant safety.
 */
export async function getLatestArtifact(
  npi: string,
  organizationId?: string,
): Promise<ArtifactRecord | null> {
  return prisma.verificationArtifact.findFirst({
    where: {
      npi,
      ...(organizationId ? { organizationId } : {}),
    },
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
  let artifact = await getLatestArtifact(npi, options.organizationId);

  if (!artifact) {
    artifact = await createArtifactFromNursys(npi, options.organizationId);
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
  const bundleEventType: ArtifactEventType = 'BUNDLE_GENERATED';
  await prisma.auditEvent.create({
    data: {
      type: bundleEventType,
      hash: computeArtifactChecksum(bundlePayload),
      clinicianId: npi,
      referenceId: artifact.id,
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
      metadata: {
        snapshotId: snapshot.id,
        checksum: artifact.checksum,
        monitoring: artifact.monitoring,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  if (options.organizationId) {
    await advanceVerifierLifecycleForBundleGeneration(options.organizationId);
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

async function advanceVerifierLifecycleForBundleGeneration(
  organizationId: string,
): Promise<void> {
  const verifierOrg = await prisma.verifierOrg.findUnique({
    where: { id: organizationId },
    select: { id: true, lifecycle: true },
  });

  if (!verifierOrg) {
    return;
  }

  const currentLifecycle = coerceVerifierLifecycle(verifierOrg.lifecycle);
  const transition = assessVerifierLifecycleTransition(
    currentLifecycle,
    'BUNDLE_GENERATED',
  );

  if (!transition.allowed) {
    log('error', 'Invalid verifier lifecycle transition', {
      event: 'verifier_lifecycle_transition_invalid',
      verifierOrgId: organizationId,
      currentLifecycle,
      targetLifecycle: 'BUNDLE_GENERATED',
      reason: transition.reason,
    });
    throw new Error('Invalid verifier lifecycle transition attempt while generating bundle');
  }

  if (transition.noOp) {
    return;
  }

  const updated = await prisma.verifierOrg.updateMany({
    where: {
      id: organizationId,
      lifecycle: currentLifecycle,
    },
    data: {
      lifecycle: 'BUNDLE_GENERATED' as VerifierLifecycle,
      pilotActivated: isVerifierLifecycleAtLeast('BUNDLE_GENERATED', 'PILOT_ACTIVATED'),
    },
  });

  if (updated.count !== 1) {
    throw new Error('Verifier lifecycle transition raced or was already applied.');
  }

  await logVerifierLifecycleTransitionEvent(
    organizationId,
    currentLifecycle,
    'BUNDLE_GENERATED',
    {
      source: 'bundle_generation',
    },
  );
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
