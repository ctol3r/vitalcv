import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { computeArtifactChecksum } from './nursysAdapter';
import { computeCredentialState } from './credentialStatusEngine';
import { validateMerkleIntegrity } from './merkleIntegrity';
import { isStrictTransitionMode, parseBooleanEnv } from '../utils/environment';
import { getConfiguredIssuerDid } from '../utils/issuerDid';
import { CredentialLifecycleState } from '../utils/lifecycleState';
import { getTransparencyEntries, type TransparencyLogEntry } from './transparencyLog';

type ArtifactForAudit = Prisma.VerificationArtifactGetPayload<{
  select: {
    id: true;
    npi: true;
    source: true;
    status: true;
    rawPayload: true;
    checksum: true;
    merkleRoot: true;
    organizationId: true;
    verifiedAt: true;
    expiresAt: true;
    trustState: true;
    revokedAt: true;
    suspendedAt: true;
    claimHashes: true;
  };
}>;

type AuditPacket = {
  artifactId: string;
  canonicalCredential: {
    '@context': string[];
    id: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    credentialSubject: {
      id: string;
      npi: string;
      source: string;
      status: string;
      trustState: string;
      verifiedAt: string;
      expiresAt: string | null;
      fingerprint: string;
      merkleRoot: string;
      organizationId: string | null;
    };
    credentialStatus: {
      id: string;
      type: string;
    };
  };
  fingerprint: string;
  merkleRoot: string;
  lifecycleState: string;
  revocationStatus: {
    revoked: boolean;
    suspended: boolean;
    expired: boolean;
  };
  issuerDID: string;
  transparencyEntries: TransparencyLogEntry[];
  proofEndpoints: {
    credentialStatus: string;
    transparency: string;
    artifactMerkle: string;
  };
  issuedVC: {
    '@context': string[];
    id: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    credentialSubject: {
      id: string;
      npi: string;
      source: string;
      status: string;
      trustState: string;
      verifiedAt: string;
      expiresAt: string | null;
      fingerprint: string;
      merkleRoot: string;
      organizationId: string | null;
    };
    credentialStatus: {
      id: string;
      type: string;
    };
  };
};

function normalizeArtifactBaseUrl(): string {
  const rawBase = process.env.BACKEND_PUBLIC_BASE_URL?.trim();
  if (!rawBase) {
    return '';
  }
  return rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
}

function buildProofEndpoints(artifactId: string): {
  credentialStatus: string;
  transparency: string;
  artifactMerkle: string;
} {
  const base = normalizeArtifactBaseUrl();
  return {
    credentialStatus: `${base}/api/credential-status/${artifactId}`,
    transparency: `${base}/api/transparency/${artifactId}`,
    artifactMerkle: `${base}/api/internal/artifact-merkle/${artifactId}`,
  };
}

function buildCanonicalCredential(
  artifact: ArtifactForAudit,
  issuedAt: string,
): {
  credential: {
    '@context': string[];
    id: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    credentialSubject: AuditPacket['issuedVC']['credentialSubject'];
    credentialStatus: {
      id: string;
      type: string;
    };
  };
  revocationStatus: {
    revoked: boolean;
    suspended: boolean;
    expired: boolean;
  };
} {
  const state = computeCredentialState(
    {
      revokedAt: artifact.revokedAt,
      suspendedAt: artifact.suspendedAt,
      expiresAt: artifact.expiresAt,
      status: artifact.status,
    },
    new Date(),
  );
  const revocationStatus = {
    revoked: state === CredentialLifecycleState.REVOKED,
    suspended: state === CredentialLifecycleState.SUSPENDED,
    expired: state === CredentialLifecycleState.EXPIRED,
  };

  const subjectId = `did:vitalcv:npi:${artifact.npi}`;
    const credential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: `urn:vitalcv:artifact:${artifact.id}`,
      type: ['VerifiableCredential', 'ClinicianIdentityCredential'],
    issuer: getConfiguredIssuerDid(),
    issuanceDate: issuedAt,
    credentialSubject: {
      id: subjectId,
      npi: artifact.npi,
      source: artifact.source,
      status: artifact.status,
      trustState: artifact.trustState,
      verifiedAt: artifact.verifiedAt.toISOString(),
      expiresAt: artifact.expiresAt ? artifact.expiresAt.toISOString() : null,
      fingerprint: artifact.checksum,
      merkleRoot: artifact.merkleRoot ?? '',
      organizationId: artifact.organizationId,
    },
    credentialStatus: {
      id: `/api/credential-status/${artifact.id}`,
      type: 'VitalCredentialStatus',
    },
  };

  return { credential, revocationStatus };
}

function validateIntegrityForAudit(artifact: ArtifactForAudit): void {
  const checksum = typeof artifact.checksum === 'string' ? artifact.checksum.trim() : '';
  const merkleRoot = artifact.merkleRoot?.trim() ?? '';

  if (!checksum) {
    throw new Error('Artifact integrity invalid: fingerprint missing.');
  }
  if (!merkleRoot) {
    throw new Error('Artifact integrity invalid: merkleRoot missing.');
  }

  const rawPayload = artifact.rawPayload as unknown;
  const expectedFingerprint = computeArtifactChecksum(rawPayload);
  if (expectedFingerprint !== checksum) {
    throw new Error('Artifact integrity invalid: fingerprint mismatch.');
  }

  const integrityValid = validateMerkleIntegrity({
    merkleRoot,
    claimHashes: artifact.claimHashes,
  });
  if (!integrityValid) {
    throw new Error('Artifact integrity invalid: merkle root mismatch.');
  }
}

export async function generateAuditPacket(artifactId: string): Promise<AuditPacket> {
  const normalizedArtifactId = artifactId.trim();
  if (!normalizedArtifactId) {
    throw new Error('artifactId is required.');
  }

  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: normalizedArtifactId },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      rawPayload: true,
      checksum: true,
      merkleRoot: true,
      organizationId: true,
      verifiedAt: true,
      expiresAt: true,
      trustState: true,
      revokedAt: true,
      suspendedAt: true,
      claimHashes: true,
    },
  });

  if (!artifact) {
    throw new Error('Artifact not found.');
  }

  if (parseBooleanEnv(process.env.STRICT_TRANSITION_MODE, false)) {
    validateIntegrityForAudit(artifact);
  }

  const lifecycleState = computeCredentialState(
    {
      revokedAt: artifact.revokedAt,
      suspendedAt: artifact.suspendedAt,
      expiresAt: artifact.expiresAt,
      status: artifact.status,
    },
    new Date(),
  );

  const { credential, revocationStatus } = buildCanonicalCredential(artifact, artifact.verifiedAt.toISOString());
  const transparencyEntries = await getTransparencyEntries(artifact.id);

  return {
    artifactId: artifact.id,
    canonicalCredential: credential,
    fingerprint: artifact.checksum,
    merkleRoot: artifact.merkleRoot ?? '',
    lifecycleState,
    revocationStatus,
    issuerDID: getConfiguredIssuerDid(),
    transparencyEntries,
    proofEndpoints: buildProofEndpoints(artifact.id),
    issuedVC: credential,
  };
}
