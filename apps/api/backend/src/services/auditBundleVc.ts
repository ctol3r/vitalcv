import type { CanonicalClaim } from '../utils/claimHash';
import {
  buildCanonicalClaimsFromArtifact,
  buildClaimDigests as buildClaimDigestsFromClaims,
  buildSelectiveDisclosurePlaceholder,
} from './auditBundleClaims';
import { sha256ForPayload } from '../utils/deterministic';
import { getConfiguredIssuerDid } from '../utils/issuerDid';

export const AUDIT_BUNDLE_VC_CONTEXT = [
  'https://www.w3.org/ns/credentials/v2',
  'https://www.w3.org/2018/credentials/v1',
] as const;

export const AUDIT_BUNDLE_VC_TYPES = [
  'VerifiableCredential',
  'AuditBundleCredential',
] as const;

export interface AuditBundlePayloadView {
  npi: string;
  artifact: {
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

export interface AuditBundleClaimDigest {
  type: string;
  value: string;
  hash: string;
}

export interface AuditBundleSelectiveDisclosure {
  algorithm: 'SD-JWT';
  hashAlgorithm: 'sha-256';
  _sd: string[];
  claims: Array<{
    type: string;
    hash: string;
  }>;
}

export interface AuditBundleVerifiableCredential {
  '@context': readonly string[];
  id: string;
  type: readonly string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: {
    id: string;
    npi: string;
    source: string;
    status: string;
    checksum: string;
    verifiedAt: string;
    expiresAt: string | null;
    monitoring: boolean;
    snapshotId: string;
    merkleRoot: string | null;
    evidenceTimestamp: string;
    verifierIdentity: string;
    methodology: string;
    monitoringStatus: string;
    claimHashes: readonly AuditBundleClaimDigest[];
    claimCount: number;
  };
  selectiveDisclosure: AuditBundleSelectiveDisclosure;
}

export interface SignedAuditBundleVerifiableCredential extends AuditBundleVerifiableCredential {
  signature: string;
  signatureAlgorithm: 'ES256';
}

export interface BuildAuditBundleVcInput {
  bundle: AuditBundlePayloadView;
  artifactId: string;
  artifactRawPayload: unknown;
  snapshotId: string;
  merkleRoot: string | null;
  issuedAt?: string;
}

function assertBundleInput(input: BuildAuditBundleVcInput): void {
  const bundle = input.bundle;
  if (bundle.npi.length === 0) {
    throw new Error('bundle.npi is required');
  }
  if (input.artifactId.trim().length === 0) {
    throw new Error('artifactId is required');
  }
  if (input.snapshotId.trim().length === 0) {
    throw new Error('snapshotId is required');
  }
  if (bundle.artifact.source.length === 0) {
    throw new Error('bundle.artifact.source is required');
  }
  if (bundle.artifact.status.length === 0) {
    throw new Error('bundle.artifact.status is required');
  }
  if (bundle.artifact.checksum.length === 0) {
    throw new Error('bundle.artifact.checksum is required');
  }
  if (bundle.artifact.verifiedAt.length === 0) {
    throw new Error('bundle.artifact.verifiedAt is required');
  }
  if (bundle.auditMetadata.timestamp.length === 0) {
    throw new Error('bundle.auditMetadata.timestamp is required');
  }
  if (bundle.auditMetadata.verifierIdentity.length === 0) {
    throw new Error('bundle.auditMetadata.verifierIdentity is required');
  }
  if (bundle.auditMetadata.checksum.length === 0) {
    throw new Error('bundle.auditMetadata.checksum is required');
  }
  if (bundle.auditMetadata.methodology.length === 0) {
    throw new Error('bundle.auditMetadata.methodology is required');
  }
  if (bundle.auditMetadata.monitoringStatus.length === 0) {
    throw new Error('bundle.auditMetadata.monitoringStatus is required');
  }
  if (artifactIdIsInvalid(bundle.auditMetadata.source)) {
    throw new Error('bundle.auditMetadata.source is required');
  }
}

function artifactIdIsInvalid(value: string): boolean {
  return value.trim().length === 0;
}

function normalizeIssuedAt(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : new Date().toISOString();
}

function buildAuditBundleClaims(
  bundle: AuditBundlePayloadView,
  artifactRawPayload: unknown,
): CanonicalClaim[] {
  return buildCanonicalClaimsFromArtifact({
    npi: bundle.npi,
    status: bundle.artifact.status,
    rawPayload: artifactRawPayload,
  });
}

function buildClaimDigests(claims: readonly CanonicalClaim[]): AuditBundleClaimDigest[] {
  return buildClaimDigestsFromClaims(claims).map((entry) => ({
    type: entry.type,
    value: entry.value,
    hash: entry.hash,
  }));
}

export function buildAuditBundleVc(input: BuildAuditBundleVcInput): AuditBundleVerifiableCredential {
  assertBundleInput(input);

  const canonicalClaims = buildAuditBundleClaims(input.bundle, input.artifactRawPayload);
  const claimHashes = buildClaimDigests(canonicalClaims);
  const selectiveDisclosure = buildSelectiveDisclosurePlaceholder(canonicalClaims);

  return {
    '@context': [...AUDIT_BUNDLE_VC_CONTEXT],
    id: `urn:vitalcv:audit-bundle:${input.snapshotId}`,
    type: [...AUDIT_BUNDLE_VC_TYPES],
    issuer: getConfiguredIssuerDid(),
    issuanceDate: normalizeIssuedAt(input.issuedAt),
    credentialSubject: {
      id: `did:vitalcv:artifact:${input.artifactId}`,
      npi: input.bundle.npi,
      source: input.bundle.artifact.source,
      status: input.bundle.artifact.status,
      checksum: input.bundle.artifact.checksum,
      verifiedAt: input.bundle.artifact.verifiedAt,
      expiresAt: input.bundle.artifact.expiresAt,
      monitoring: input.bundle.artifact.monitoring,
      snapshotId: input.snapshotId,
      merkleRoot: input.merkleRoot,
      evidenceTimestamp: input.bundle.auditMetadata.timestamp,
      verifierIdentity: input.bundle.auditMetadata.verifierIdentity,
      methodology: input.bundle.auditMetadata.methodology,
      monitoringStatus: input.bundle.auditMetadata.monitoringStatus,
      claimHashes,
      claimCount: claimHashes.length,
    },
    selectiveDisclosure,
  };
}

export function computeAuditBundleVcHash(vc: AuditBundleVerifiableCredential): string {
  return sha256ForPayload(vc);
}

export function attachAuditBundleSignature(
  vc: AuditBundleVerifiableCredential,
  signature: string,
): SignedAuditBundleVerifiableCredential {
  return {
    ...vc,
    signature,
    signatureAlgorithm: 'ES256',
  };
}
