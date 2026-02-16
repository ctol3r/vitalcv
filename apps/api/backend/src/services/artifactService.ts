import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import type { VerificationResult } from '../interfaces/verificationSource';
import type { CanonicalClaim } from '../utils/claimHash';
import {
  assessVerifierLifecycleTransition,
  coerceVerifierLifecycle,
  isVerifierLifecycleAtLeast,
  logVerifierLifecycleTransitionEvent,
} from './verifierLifecycle';
import { log } from '../obs/logger';
import { computeArtifactChecksum } from './nursysAdapter';
import { getVerificationSource } from './sourceRegistry';
import { buildMerkleTree } from './merkleTree';
import { computeTrustState } from './trustState';
import { computeCredentialState } from './credentialStatusEngine';
import type { ArtifactEventType } from '../types/auditEventTypes';

const MONITORING_THRESHOLD_DAYS = 90;
const STRICT_TRANSITION_MODE = (() => {
  const raw = process.env.STRICT_TRANSITION_MODE?.trim().toLowerCase();
  const trueValues = new Set(['1', 'true', 'yes', 'on']);
  return raw !== undefined && trueValues.has(raw);
})();

type ArtifactMerklePayload = {
  fingerprint: string;
  merkleRoot: string;
  claimHashes: string[];
};

export type ArtifactRecord = {
  id: string;
  npi: string;
  source: string;
  status: string;
  rawPayload: Prisma.JsonValue;
  revokedAt: Date | null;
  suspendedAt: Date | null;
  revocationReason: string | null;
  lifecycleState: string;
  statusLastChecked: Date;
  checksum: string;
  fingerprint: string;
  merkleRoot: string;
  claimHashes: Prisma.JsonValue;
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
 * Build deterministic Merkle/claim metadata for a verification payload.
 */
export function buildVerificationMerklePayload(
  npi: string,
  result: VerificationResult,
): ArtifactMerklePayload {
  const claims = canonicalizeVerificationClaims(npi, result);
  const tree = buildMerkleTree(claims);
  const fingerprint = computeArtifactChecksum(result.rawPayload);

  return {
    fingerprint,
    merkleRoot: tree.root,
    claimHashes: tree.leaves,
  };
}

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
  const { fingerprint, merkleRoot, claimHashes } = buildVerificationMerklePayload(npi, result);

  enforceStrictTransitionRequirements(fingerprint, merkleRoot, claimHashes);

  const verifiedAt = new Date();

  const expiresAt = result.expirationDate ?? null;
  const monitoring = shouldMonitor(expiresAt);
  const trustState = computeTrustState({ status: result.licenseStatus, expiresAt, monitoring });
  const statusLastChecked = new Date();
  const lifecycleState = computeCredentialState(
    {
      revokedAt: null,
      suspendedAt: null,
      expiresAt,
      status: result.licenseStatus,
    },
    statusLastChecked,
  );

  const artifact = await prisma.verificationArtifact.create({
    data: {
      npi,
      source: 'NURSYS',
      status: result.licenseStatus,
      rawPayload: result.rawPayload as Prisma.InputJsonValue,
      checksum: fingerprint,
      merkleRoot,
      claimHashes: claimHashes as unknown as Prisma.InputJsonValue,
      lifecycleState,
      statusLastChecked,
      verifiedAt,
      expiresAt,
      monitoring,
      trustState,
      ...(organizationId ? { organizationId } : {}),
    },
  }) as unknown as ArtifactRecord;

  return {
    ...artifact,
    fingerprint,
    merkleRoot,
    claimHashes,
  };
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
  const artifact = await prisma.verificationArtifact.findFirst({
    where: {
      npi,
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!artifact) {
    return null;
  }

  return {
    ...artifact,
    revokedAt: artifact.revokedAt,
    suspendedAt: artifact.suspendedAt,
    revocationReason: artifact.revocationReason ?? null,
    lifecycleState: artifact.lifecycleState,
    statusLastChecked: artifact.statusLastChecked,
    checksum: artifact.checksum,
    fingerprint: artifact.checksum,
    merkleRoot: artifact.merkleRoot ?? '',
    claimHashes: artifact.claimHashes ?? [],
  };
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
      lifecycle: 'BUNDLE_GENERATED',
      pilotActivated: isVerifierLifecycleAtLeast(currentLifecycle, 'PILOT_ACTIVATED'),
    },
  });

  if (updated.count !== 1) {
    throw new Error('Verifier lifecycle transition raced or was already applied.');
  }

  try {
    await logVerifierLifecycleTransitionEvent(
      organizationId,
      currentLifecycle,
      'BUNDLE_GENERATED',
      {
        source: 'bundle_generation',
      },
    );
  } catch (error) {
    await prisma.verifierOrg.updateMany({
      where: { id: organizationId, lifecycle: 'BUNDLE_GENERATED' },
      data: {
        lifecycle: currentLifecycle,
        pilotActivated: isVerifierLifecycleAtLeast(currentLifecycle, 'PILOT_ACTIVATED'),
      },
    });

    log('error', 'Verifier lifecycle transition persistence failure', {
      event: 'verifier_bundle_lifecycle_persistence_error',
      verifierOrgId: organizationId,
      currentLifecycle,
      targetLifecycle: 'BUNDLE_GENERATED',
      message: error instanceof Error ? error.message : 'Unknown persistence error',
    });

    throw error instanceof Error
      ? error
      : new Error('Failed to persist verifier lifecycle transition');
  }
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

export function canonicalizeVerificationClaims(
  npi: string,
  result: VerificationResult,
): CanonicalClaim[] {
  const claims = new Map<string, string>();

  const addClaim = (type: string, value: string | number | boolean | null): void => {
    const normalizedType = type.trim();
    if (normalizedType.length === 0) {
      return;
    }
    const normalizedValue = String(value);

    const existingValue = claims.get(normalizedType);
    if (existingValue !== undefined) {
      if (existingValue !== normalizedValue) {
        throw new Error(`Conflicting canonical claim values for type "${normalizedType}"`);
      }
      return;
    }

    claims.set(normalizedType, normalizedValue);
  };

  addClaim('npi', npi);
  addClaim('licenseStatus', result.licenseStatus);
  addClaim('jurisdiction', result.jurisdiction);
  addClaim('sourceUrl', result.sourceUrl);
  addClaim('lastUpdated', result.lastUpdated.toISOString());
  addClaim('expirationDate', result.expirationDate ? result.expirationDate.toISOString() : null);

  const rawPayload = result.rawPayload;
  if (rawPayload !== null && typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
    const payloadEntries = Object.entries(rawPayload as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );

    for (const [type, value] of payloadEntries) {
      if (type.length === 0) {
        continue;
      }
      if (value instanceof Date) {
        addClaim(type, value.toISOString());
        continue;
      }
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        addClaim(type, value);
      }
    }
  }

  return [...claims.entries()].map(([type, value]) => ({ type, value }));
}

function enforceStrictTransitionRequirements(
  fingerprint: string,
  merkleRoot: string,
  claimHashes: string[],
): void {
  if (!STRICT_TRANSITION_MODE) {
    return;
  }

  const missing: string[] = [];
  if (fingerprint.length === 0) {
    missing.push('fingerprint');
  }
  if (merkleRoot.length === 0) {
    missing.push('merkleRoot');
  }
  if (claimHashes.length === 0) {
    missing.push('claimHashes');
  }

  if (missing.length > 0) {
    throw new Error(`strict mode missing required artifact fields: ${missing.join(',')}`);
  }
}
