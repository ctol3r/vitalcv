import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import type { VerificationResult } from '../interfaces/verificationSource';
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
import { buildCanonicalClaimsFromVerificationResult } from './auditBundleClaims';
import { computeTrustState } from './trustState';
import { computeCredentialState } from './credentialStatusEngine';
import { runIndependentCrossCheck } from './crossCheckEngine';
import type { ArtifactEventType } from '../types/auditEventTypes';
import { appendArtifactLifecycleEntry } from './transparencyLedger';
import { assertMonitoringEngineEnabled } from './credentialMonitoringEngine';
import { isStrictTransitionMode } from '../utils/environment';
import {
  AUDITSCRAPBOOK_COMPLIANCE_PROFILE,
  AUDITSCRAPBOOK_METHOD,
  AUDITSCRAPBOOK_METHODLOGY_VERSION,
  AUDITSCRAPBOOK_VERIFIER_IDENTITY,
  buildVerifierAuditBundle,
  type ArtifactForVerifierAuditBundle,
  type VerifierAuditBundle,
} from './verifierAuditBundle';
import { getTransparencyEntries } from './transparencyLog';
import {
  attachAuditBundleSignature,
  buildAuditBundleVc,
  computeAuditBundleVcHash,
  type AuditBundlePayloadView,
  type SignedAuditBundleVerifiableCredential,
} from './auditBundleVc';
import { signAuditBundleHash } from './auditBundleSigning';

const MONITORING_THRESHOLD_DAYS = 90;

export type AuditBundleMetadataInput = {
  timestamp: string;
  verifierIdentity: string;
  methodology: string;
  monitoringStatus: string;
};

export interface AuditBundlePayload {
  npi: string;
  artifact: {
    id: string;
    source: string;
    status: string;
    checksum: string;
    verifiedAt: string;
    expiresAt: string | null;
    monitoring: boolean;
  };
  auditMetadata: {
    source: string;
    timestamp: string;
    verifierIdentity: string;
    checksum: string;
    methodology: string;
    monitoringStatus: string;
  };
}

export interface AuditBundleResult extends AuditBundlePayload {
  snapshotId: string;
  rawPayload: Prisma.JsonValue;
  verifierAuditBundle: VerifierAuditBundle;
}

export interface AuditBundleExportResult {
  rawBundle: AuditBundlePayload;
  vcWrapped: SignedAuditBundleVerifiableCredential;
  hash: string;
  signature: string;
}

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
  merkleRoot: string | null;
  claimHashes: Prisma.JsonValue;
  verifiedAt: Date;
  expiresAt: Date | null;
  monitoring: boolean;
  trustState: string;
  organizationId: string | null;
  psvWindowStart: Date | null;
  psvWindowDeadline: Date | null;
  psvWindowCompliant: boolean | null;
  daysUntilExpiration: number | null;
  forecastRiskLevel: string | null;
  createdAt: Date;
};

type GenerateAuditBundleOptions = {
  organizationId?: string;
};

const artifactRecordSelect = {
  id: true,
  npi: true,
  source: true,
  status: true,
  rawPayload: true,
  revokedAt: true,
  suspendedAt: true,
  revocationReason: true,
  lifecycleState: true,
  statusLastChecked: true,
  checksum: true,
  merkleRoot: true,
  claimHashes: true,
  verifiedAt: true,
  expiresAt: true,
  monitoring: true,
  trustState: true,
  organizationId: true,
  psvWindowStart: true,
  psvWindowDeadline: true,
  psvWindowCompliant: true,
  daysUntilExpiration: true,
  forecastRiskLevel: true,
  createdAt: true,
} satisfies Prisma.VerificationArtifactSelect;

type SnapshotArtifact = {
  id: string;
  npi: string;
  source: string;
  status: string;
  rawPayload: Prisma.JsonValue;
  checksum: string;
  merkleRoot: string | null;
  verifiedAt: Date;
  expiresAt: Date | null;
  monitoring: boolean;
};

type SnapshotRecord = {
  id: string;
  snapshot: Prisma.JsonValue;
  artifact: SnapshotArtifact;
};

/**
 * Build deterministic Merkle/claim metadata for a verification payload.
 */
export function buildVerificationMerklePayload(
  npi: string,
  result: VerificationResult,
): ArtifactMerklePayload {
  const claims = buildCanonicalClaimsFromVerificationResult(npi, result);
  const tree = buildMerkleTree(claims);
  const fingerprint = computeArtifactChecksum(result.rawPayload);

  return {
    fingerprint,
    merkleRoot: tree.root,
    claimHashes: tree.leaves,
  };
}

export function buildAuditBundlePayload(
  artifact: ArtifactRecord,
  options: AuditBundleMetadataInput,
): AuditBundlePayload {
  return {
    npi: artifact.npi,
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
      timestamp: options.timestamp,
      verifierIdentity: options.verifierIdentity,
      checksum: artifact.checksum,
      methodology: options.methodology,
      monitoringStatus: options.monitoringStatus,
    },
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
  if (isStrictTransitionMode()) {
    await assertMonitoringEngineEnabled();
  }

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

  const artifact = await prisma.$transaction(async (tx) => {
    const created = await tx.verificationArtifact.create({
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
      select: artifactRecordSelect,
    });

    await appendArtifactLifecycleEntry(
      {
        id: created.id,
        checksum: created.checksum,
        merkleRoot: created.merkleRoot ?? '',
        lifecycleState,
        organizationId: created.organizationId,
      },
      { tx },
    );

    if (isStrictTransitionMode()) {
      const crossCheckResult = await runIndependentCrossCheck(created.id, tx);
      if (!crossCheckResult.passed) {
        throw new Error(
          `Strict mode cross-check failed: ${crossCheckResult.failures.join(', ') || 'unknown'}`,
        );
      }
    }

    return created as unknown as ArtifactRecord;
  });

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
    select: artifactRecordSelect,
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
    fingerprint: artifact.checksum,
    claimHashes: artifact.claimHashes,
  };
}

/**
 * Generate an NCQA-aligned audit bundle for a given NPI.
 * Creates an AuditSnapshot to freeze the bundle state at generation time.
 */
export async function generateAuditBundle(
  npi: string,
  options: GenerateAuditBundleOptions = {},
): Promise<AuditBundleResult> {
  let artifact = await getLatestArtifact(npi, options.organizationId);

  if (!artifact) {
    artifact = await createArtifactFromNursys(npi, options.organizationId);
  }

  const timestamp = new Date().toISOString();
  const verifierIdentity = AUDITSCRAPBOOK_VERIFIER_IDENTITY;
  const methodology = AUDITSCRAPBOOK_METHOD;
  const monitoringStatus = artifact.monitoring ? 'ACTIVE_MONITORING' : 'STANDARD';

  const bundlePayload = buildAuditBundlePayload(artifact, {
    timestamp,
    verifierIdentity,
    methodology,
    monitoringStatus,
  });
  const transparencyEntries = await getTransparencyEntries(artifact.id);
  const verifierAuditBundle = buildVerifierAuditBundle(
    artifact as unknown as ArtifactForVerifierAuditBundle,
    {
      generatedAt: timestamp,
      verifierIdentity,
      methodology,
      monitoringStatus,
      transparencyEntries,
    },
  );

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
        methodologyVersion: AUDITSCRAPBOOK_METHODLOGY_VERSION,
        complianceProfile: AUDITSCRAPBOOK_COMPLIANCE_PROFILE,
        tamperAnchor: verifierAuditBundle.tamperAnchoring.chainDigest,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  if (options.organizationId) {
    await advanceVerifierLifecycleForBundleGeneration(options.organizationId);
    await incrementPilotPlanBundleCount(options.organizationId);
  }

  return {
    npi,
    artifact: {
      id: artifact.id,
      source: artifact.source,
      status: artifact.status,
      checksum: artifact.checksum,
      verifiedAt: artifact.verifiedAt.toISOString(),
      expiresAt: artifact.expiresAt ? artifact.expiresAt.toISOString() : null,
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
    snapshotId: snapshot.id,
    rawPayload: artifact.rawPayload,
    verifierAuditBundle,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseStringField(
  record: Record<string, unknown>,
  field: string,
  required = true,
): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    if (required) {
      throw new Error(`Snapshot payload missing required field: ${field}`);
    }
    return '';
  }

  return value;
}

function parseBooleanField(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  return value === true;
}

function parseAuditMetadataField(record: Record<string, unknown>): AuditBundlePayloadView['auditMetadata'] {
  if (!isRecord(record)) {
    throw new Error('Audit bundle snapshot missing auditMetadata');
  }

  return {
    source: parseStringField(record, 'source'),
    timestamp: parseStringField(record, 'timestamp'),
    verifierIdentity: parseStringField(record, 'verifierIdentity'),
    checksum: parseStringField(record, 'checksum'),
    methodology: parseStringField(record, 'methodology'),
    monitoringStatus: parseStringField(record, 'monitoringStatus'),
  };
}

function parseArtifactSection(
  record: Record<string, unknown>,
  artifactId: string,
): AuditBundlePayload['artifact'] {
  return {
    id: artifactId,
    source: parseStringField(record, 'source'),
    status: parseStringField(record, 'status'),
    checksum: parseStringField(record, 'checksum'),
    verifiedAt: parseStringField(record, 'verifiedAt'),
    expiresAt: parseStringField(record, 'expiresAt', false) || null,
    monitoring: parseBooleanField(record, 'monitoring'),
  };
}

function parseAuditBundleSnapshot(snapshot: Prisma.JsonValue, artifactId: string): AuditBundlePayload {
  if (!isRecord(snapshot)) {
    throw new Error('Invalid audit snapshot payload');
  }

  const npi = parseStringField(snapshot, 'npi');
  const artifact = snapshot.artifact;
  const auditMetadata = snapshot.auditMetadata;
  if (!isRecord(artifact)) {
    throw new Error('Invalid audit snapshot payload: artifact is missing');
  }
  if (!isRecord(auditMetadata)) {
    throw new Error('Invalid audit snapshot payload: auditMetadata is missing');
  }

  return {
    npi,
    artifact: parseArtifactSection(artifact as Record<string, unknown>, artifactId),
    auditMetadata: parseAuditMetadataField(auditMetadata as Record<string, unknown>),
  };
}

export async function getBundleExportBySnapshotId(snapshotId: string): Promise<AuditBundleExportResult> {
  const normalizedId = snapshotId.trim();
  if (!normalizedId) {
    throw new Error('snapshotId is required');
  }

  const snapshot = await prisma.auditSnapshot.findUnique({
    where: { id: normalizedId },
    select: {
      id: true,
      snapshot: true,
      artifact: {
        select: {
          id: true,
          npi: true,
          source: true,
          status: true,
          rawPayload: true,
          checksum: true,
          merkleRoot: true,
          verifiedAt: true,
          expiresAt: true,
          monitoring: true,
        },
      },
    },
  }) as SnapshotRecord | null;

  if (!snapshot || !snapshot.artifact) {
    throw new Error('Audit snapshot not found');
  }

  const rawBundle = parseAuditBundleSnapshot(snapshot.snapshot, snapshot.artifact.id);
  const issuedAt = rawBundle.auditMetadata.timestamp;

  const vc = buildAuditBundleVc({
    bundle: rawBundle,
    artifactId: snapshot.artifact.id,
    artifactRawPayload: snapshot.artifact.rawPayload,
    snapshotId: snapshot.id,
    merkleRoot: snapshot.artifact.merkleRoot,
    issuedAt,
  });
  const hash = computeAuditBundleVcHash(vc);
  const signature = await signAuditBundleHash({
    bundleHash: hash,
    bundleId: snapshot.id,
    artifactId: snapshot.artifact.id,
    issuedAt,
  });
  const vcWrapped = attachAuditBundleSignature(vc, signature);

  return {
    rawBundle,
    vcWrapped,
    hash,
    signature,
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

function enforceStrictTransitionRequirements(
  fingerprint: string,
  merkleRoot: string,
  claimHashes: string[],
): void {
  if (!isStrictTransitionMode()) {
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
