import type { Prisma } from '@prisma/client';
import prisma from '../src/graphql/prisma_client';
import { computeArtifactChecksum } from '../src/services/nursysAdapter';
import {
  AUDITSCRAPBOOK_COMPLIANCE_PROFILE,
  AUDITSCRAPBOOK_METHOD,
  AUDITSCRAPBOOK_METHODLOGY_VERSION,
  AUDITSCRAPBOOK_VERIFIER_IDENTITY,
  buildVerifierAuditBundle,
  type ArtifactForVerifierAuditBundle,
  type VerifierAuditBundle,
} from '../src/services/verifierAuditBundle';
import { getTransparencyEntries } from '../src/services/transparencyLog';
import {
  buildAuditScrapbookBundle,
  buildAuditScrapbookEntry,
  type AuditScrapbookBundle,
} from '../src/services/audit/auditScrapbookBundle';
import type {
  CanonicalCredentialArtifact,
  CanonicalVerificationArtifact,
} from '../src/services/credentials/credentialIngestionTypes';
import {
  isCanonicalCredentialArtifact,
  isCanonicalVerificationArtifact,
} from '../src/services/credentials/credentialIngestionTypes';

export interface AuditBundleMetadata {
  source: string;
  timestamp: string;
  verifierIdentity: string;
  checksum: string;
  methodology: string;
  monitoringStatus: string;
}

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
  auditMetadata: AuditBundleMetadata;
  auditScrapbookBundle?: AuditScrapbookBundle;
}

export interface AuditBundleResult extends AuditBundlePayload {
  snapshotId: string;
  rawPayload: Prisma.JsonValue;
  verifierAuditBundle: VerifierAuditBundle;
  auditScrapbookBundle: AuditScrapbookBundle;
}

export interface GetAuditBundleOptions {
  organizationId?: string;
}

export interface VerificationArtifactRecord {
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
}

export interface CredentialEvidenceRecord {
  credentialId: string;
  verificationArtifactId: string | null;
  relatedCompatibilityArtifactId: string | null;
  credentialType: string;
  issuerId: string;
  source: string;
  status: string;
  verificationMethod: string;
  verifiedAt: string;
  freshUntil: string | null;
  sourceType: string | null;
  sourceResponseArtifact: Record<string, unknown>;
  normalizedCredentialFacts: Record<string, unknown>;
  compatibilityArtifact: VerificationArtifactRecord | null;
}

const verificationArtifactSelect = {
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

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function deriveCredentialTypeFromSource(source: string): string {
  const normalized = source.trim().toUpperCase();
  if (normalized === 'NPPES') {
    return 'NPI_ENROLLMENT';
  }
  if (normalized === 'OIG') {
    return 'OIG_EXCLUSION';
  }
  if (normalized === 'STATE_BOARD') {
    return 'STATE_LICENSE';
  }
  return normalized || 'UNKNOWN_CREDENTIAL';
}

function deriveVerificationMethod(source: string, payload: Record<string, unknown>): string {
  const rawMethod = payload.verification_method;
  if (typeof rawMethod === 'string' && rawMethod.trim()) {
    return rawMethod;
  }

  const normalized = source.trim().toUpperCase();
  if (normalized === 'NPPES' || normalized === 'STATE_BOARD') {
    return 'API';
  }
  if (normalized === 'OIG') {
    return 'BULK_DOWNLOAD';
  }
  return 'UNKNOWN';
}

function buildNormalizedCredentialFacts(
  credentialArtifact: CanonicalCredentialArtifact | null,
  verificationArtifact: CanonicalVerificationArtifact | null,
  compatibilityArtifact: VerificationArtifactRecord | null,
): Record<string, unknown> {
  if (credentialArtifact && verificationArtifact) {
    return {
      subject_npi: credentialArtifact.subject_npi,
      credential_type: credentialArtifact.credential_type,
      issuer_org_id: credentialArtifact.issuer_org_id,
      status: credentialArtifact.status,
      issued_at: credentialArtifact.issued_at,
      expires_at: credentialArtifact.expires_at,
      metadata: credentialArtifact.metadata ?? {},
      verification: {
        source_name: verificationArtifact.source_name,
        source_type: verificationArtifact.source_type,
        verification_method: verificationArtifact.verification_method,
        verified_at: verificationArtifact.verified_at,
        fresh_until: verificationArtifact.fresh_until,
      },
    };
  }

  if (compatibilityArtifact) {
    return {
      npi: compatibilityArtifact.npi,
      source: compatibilityArtifact.source,
      status: compatibilityArtifact.status,
      verifiedAt: compatibilityArtifact.verifiedAt.toISOString(),
      expiresAt: compatibilityArtifact.expiresAt?.toISOString() ?? null,
      trustState: compatibilityArtifact.trustState,
      rawPayload: asRecord(compatibilityArtifact.rawPayload),
    };
  }

  return {};
}

function buildAuditBundlePayload(
  artifact: VerificationArtifactRecord,
  timestamp: string,
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
      timestamp,
      verifierIdentity: AUDITSCRAPBOOK_VERIFIER_IDENTITY,
      checksum: artifact.checksum,
      methodology: AUDITSCRAPBOOK_METHOD,
      monitoringStatus: artifact.monitoring ? 'ACTIVE_MONITORING' : 'STANDARD',
    },
  };
}

export async function getVerificationArtifacts(
  npi: string,
  options: GetAuditBundleOptions = {},
): Promise<VerificationArtifactRecord[]> {
  return prisma.verificationArtifact.findMany({
    where: options.organizationId
      ? {
          npi,
          OR: [
            { organizationId: null },
            { organizationId: options.organizationId },
          ],
        }
      : { npi },
    orderBy: [
      { verifiedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    select: verificationArtifactSelect,
  });
}

type VerificationRunArtifactRow = {
  id: string;
  artifactJson: Prisma.JsonValue;
};

type VerificationRunRow = {
  id: string;
  retrievedAtUtc: Date;
  artifacts: VerificationRunArtifactRow[];
};

function extractCanonicalPair(run: VerificationRunRow): {
  credentialArtifactId: string;
  credentialArtifact: CanonicalCredentialArtifact;
  verificationArtifactId: string;
  verificationArtifact: CanonicalVerificationArtifact;
} | null {
  let credentialArtifactId = '';
  let credentialArtifact: CanonicalCredentialArtifact | null = null;
  let verificationArtifactId = '';
  let verificationArtifact: CanonicalVerificationArtifact | null = null;

  for (const artifact of run.artifacts) {
    if (!credentialArtifact && isCanonicalCredentialArtifact(artifact.artifactJson)) {
      credentialArtifact = artifact.artifactJson;
      credentialArtifactId = artifact.id;
      continue;
    }

    if (!verificationArtifact && isCanonicalVerificationArtifact(artifact.artifactJson)) {
      verificationArtifact = artifact.artifactJson;
      verificationArtifactId = artifact.id;
    }
  }

  if (!credentialArtifact || !verificationArtifact) {
    return null;
  }

  return {
    credentialArtifactId,
    credentialArtifact,
    verificationArtifactId,
    verificationArtifact,
  };
}

export async function getCredentialEvidence(
  npi: string,
  options: GetAuditBundleOptions = {},
): Promise<CredentialEvidenceRecord[]> {
  const compatibilityArtifacts = await getVerificationArtifacts(npi, options);
  const compatibilityByChecksum = new Map(
    compatibilityArtifacts.map((artifact) => [artifact.checksum, artifact] as const),
  );

  const runs = await prisma.verificationRun.findMany({
    where: {
      provider: { npi },
    },
    include: {
      artifacts: {
        select: {
          id: true,
          artifactJson: true,
        },
      },
    },
    orderBy: { retrievedAtUtc: 'desc' },
  });

  const canonicalEvidence = runs.flatMap((run) => {
    const pair = extractCanonicalPair(run);
    if (!pair) {
      return [];
    }

    const compatibilityArtifact = compatibilityByChecksum.get(pair.verificationArtifact.evidence_hash) ?? null;
    return [{
      credentialId: pair.credentialArtifactId,
      verificationArtifactId: pair.verificationArtifactId,
      relatedCompatibilityArtifactId: compatibilityArtifact?.id ?? null,
      credentialType: pair.credentialArtifact.credential_type,
      issuerId: pair.credentialArtifact.issuer_org_id,
      source: pair.verificationArtifact.source_name,
      status: pair.credentialArtifact.status,
      verificationMethod: pair.verificationArtifact.verification_method,
      verifiedAt: pair.verificationArtifact.verified_at,
      freshUntil: pair.verificationArtifact.fresh_until,
      sourceType: pair.verificationArtifact.source_type,
      sourceResponseArtifact: asRecord(pair.verificationArtifact.payload_json),
      normalizedCredentialFacts: buildNormalizedCredentialFacts(
        pair.credentialArtifact,
        pair.verificationArtifact,
        compatibilityArtifact,
      ),
      compatibilityArtifact,
    }];
  });

  if (canonicalEvidence.length > 0) {
    return canonicalEvidence;
  }

  return compatibilityArtifacts.map((artifact) => {
    const payload = asRecord(artifact.rawPayload);
    return {
      credentialId: artifact.id,
      verificationArtifactId: artifact.id,
      relatedCompatibilityArtifactId: artifact.id,
      credentialType: deriveCredentialTypeFromSource(artifact.source),
      issuerId: artifact.source,
      source: artifact.source,
      status: artifact.status,
      verificationMethod: deriveVerificationMethod(artifact.source, payload),
      verifiedAt: artifact.verifiedAt.toISOString(),
      freshUntil: artifact.psvWindowDeadline?.toISOString() ?? artifact.expiresAt?.toISOString() ?? null,
      sourceType: artifact.source,
      sourceResponseArtifact: payload,
      normalizedCredentialFacts: buildNormalizedCredentialFacts(null, null, artifact),
      compatibilityArtifact: artifact,
    };
  });
}

function extractDecisionLinkage(
  capsule: {
    id: string;
    decisionType: string;
    credentialIds: string[];
    metadata: Prisma.JsonValue;
  },
): {
  credentialIds: string[];
} {
  const metadata = asRecord(capsule.metadata);
  const compatibilityCredentialIds = Array.isArray(metadata.compatibility_credential_ids)
    ? metadata.compatibility_credential_ids.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    credentialIds: [...new Set([...capsule.credentialIds, ...compatibilityCredentialIds])],
  };
}

export async function generateAuditBundle(
  npi: string,
  options: GetAuditBundleOptions = {},
): Promise<AuditBundleResult> {
  const artifacts = await getVerificationArtifacts(npi, options);
  const latestArtifact = artifacts[0];
  if (!latestArtifact) {
    throw new Error(`No verification artifacts found for ${npi}`);
  }

  const timestamp = new Date().toISOString();
  const bundlePayload = buildAuditBundlePayload(latestArtifact, timestamp);
  const transparencyEntries = await getTransparencyEntries(latestArtifact.id);
  const verifierAuditBundle = buildVerifierAuditBundle(
    latestArtifact as unknown as ArtifactForVerifierAuditBundle,
    {
      generatedAt: timestamp,
      verifierIdentity: AUDITSCRAPBOOK_VERIFIER_IDENTITY,
      methodology: AUDITSCRAPBOOK_METHOD,
      monitoringStatus: bundlePayload.auditMetadata.monitoringStatus,
      snapshotId: undefined,
      transparencyEntries,
    },
  );

  const [credentialEvidence, capsules] = await Promise.all([
    getCredentialEvidence(npi, options),
    prisma.decisionCapsule.findMany({
      where: { subjectNpi: npi },
      select: {
        id: true,
        decisionType: true,
        credentialIds: true,
        metadata: true,
      },
    }),
  ]);

  const scrapbookEntries = await Promise.all(credentialEvidence.map(async (evidence) => {
    const linkedCapsules = capsules.filter((capsule) => {
      const linkage = extractDecisionLinkage(capsule);
      if (linkage.credentialIds.includes(evidence.credentialId)) {
        return true;
      }
      return evidence.relatedCompatibilityArtifactId
        ? linkage.credentialIds.includes(evidence.relatedCompatibilityArtifactId)
        : false;
    });

    const provenance = evidence.compatibilityArtifact
      ? await getTransparencyEntries(evidence.compatibilityArtifact.id)
      : [];
    const chainDigest = evidence.compatibilityArtifact
      ? buildVerifierAuditBundle(
          evidence.compatibilityArtifact as unknown as ArtifactForVerifierAuditBundle,
          {
            generatedAt: timestamp,
            verifierIdentity: AUDITSCRAPBOOK_VERIFIER_IDENTITY,
            methodology: AUDITSCRAPBOOK_METHOD,
            monitoringStatus: evidence.compatibilityArtifact.monitoring ? 'ACTIVE_MONITORING' : 'STANDARD',
            snapshotId: undefined,
            transparencyEntries: provenance,
          },
        ).tamperAnchoring.chainDigest
      : null;

    return buildAuditScrapbookEntry({
      credentialId: evidence.credentialId,
      verificationArtifactId: evidence.verificationArtifactId,
      subjectNpi: npi,
      credentialType: evidence.credentialType,
      source: evidence.source,
      status: evidence.status,
      sourceResponseArtifact: evidence.sourceResponseArtifact,
      normalizedCredentialFacts: evidence.normalizedCredentialFacts,
      verificationMethod: evidence.verificationMethod,
      verificationMetadata: {
        status: evidence.status,
        verifiedAt: evidence.verifiedAt,
        freshUntil: evidence.freshUntil,
        sourceType: evidence.sourceType,
        organizationId: evidence.compatibilityArtifact?.organizationId ?? null,
      },
      verifiedAt: evidence.verifiedAt,
      verifierAgent: AUDITSCRAPBOOK_VERIFIER_IDENTITY,
      provenanceChain: provenance.map((entry) => ({
        createdAt: entry.createdAt.toISOString(),
        fingerprint: entry.fingerprint,
        merkleRoot: entry.merkleRoot,
        lifecycleState: entry.lifecycleState,
      })),
      ledgerAnchor: {
        artifactId: evidence.compatibilityArtifact?.id ?? null,
        merkleRoot: evidence.compatibilityArtifact?.merkleRoot ?? null,
        checksum: evidence.compatibilityArtifact?.checksum ?? null,
        chainDigest,
      },
      decisionCapsuleIds: linkedCapsules.map((capsule) => capsule.id),
      decisionTypes: linkedCapsules.map((capsule) => capsule.decisionType),
    });
  }));

  const auditScrapbookBundle = buildAuditScrapbookBundle({
    npi,
    generatedAt: timestamp,
    methodologyVersion: AUDITSCRAPBOOK_METHODLOGY_VERSION,
    verifierAgent: AUDITSCRAPBOOK_VERIFIER_IDENTITY,
    entries: scrapbookEntries,
  });

  const snapshot = await prisma.auditSnapshot.create({
    data: {
      artifactId: latestArtifact.id,
      snapshot: {
        ...bundlePayload,
        auditScrapbookBundle,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.auditEvent.create({
    data: {
      type: 'BUNDLE_GENERATED',
      hash: computeArtifactChecksum(bundlePayload),
      clinicianId: npi,
      referenceId: latestArtifact.id,
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
      metadata: {
        snapshotId: snapshot.id,
        checksum: latestArtifact.checksum,
        monitoring: latestArtifact.monitoring,
        methodologyVersion: AUDITSCRAPBOOK_METHODLOGY_VERSION,
        complianceProfile: AUDITSCRAPBOOK_COMPLIANCE_PROFILE,
        tamperAnchor: verifierAuditBundle.tamperAnchoring.chainDigest,
        auditScrapbookHash: auditScrapbookBundle.bundleHash,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    ...bundlePayload,
    snapshotId: snapshot.id,
    rawPayload: latestArtifact.rawPayload,
    verifierAuditBundle,
    auditScrapbookBundle,
  };
}
