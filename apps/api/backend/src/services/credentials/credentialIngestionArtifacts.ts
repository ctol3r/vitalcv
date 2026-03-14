import { sha256ForPayload } from '../../utils/deterministic';
import type {
  CanonicalCredentialArtifact,
  CanonicalVerificationArtifact,
  CredentialVerificationSourceType,
} from './credentialIngestionTypes';

type CredentialArtifactInput = Omit<CanonicalCredentialArtifact, 'kind' | 'credential_hash'>;
type VerificationArtifactInput = Omit<CanonicalVerificationArtifact, 'kind' | 'evidence_hash'>;

const ACTIVE_STATUSES = new Set(['ACTIVE', 'VERIFIED', 'CLEAR']);

function addDuration(verifiedAt: string, durationMs: number): string {
  return new Date(Date.parse(verifiedAt) + durationMs).toISOString();
}

export function addDays(verifiedAt: string, days: number): string {
  return addDuration(verifiedAt, days * 24 * 60 * 60 * 1000);
}

export function addHours(verifiedAt: string, hours: number): string {
  return addDuration(verifiedAt, hours * 60 * 60 * 1000);
}

export function buildCredentialHash(
  artifact: Omit<CanonicalCredentialArtifact, 'credential_hash'>,
): string {
  return sha256ForPayload(artifact);
}

export function buildEvidenceHash(payloadJson: Record<string, unknown>): string {
  return sha256ForPayload(payloadJson);
}

export function createCredentialArtifactRecord(
  input: CredentialArtifactInput,
): CanonicalCredentialArtifact {
  const artifactWithoutHash = {
    kind: 'credential_artifact' as const,
    ...input,
  };

  return {
    ...artifactWithoutHash,
    credential_hash: buildCredentialHash(artifactWithoutHash),
  };
}

export function createVerificationArtifactRecord(
  input: VerificationArtifactInput,
): CanonicalVerificationArtifact {
  return {
    kind: 'verification_artifact',
    ...input,
    evidence_hash: buildEvidenceHash(input.payload_json),
  };
}

export function buildRunArtifactHash(
  artifacts: readonly [CanonicalCredentialArtifact, CanonicalVerificationArtifact],
): string {
  return sha256ForPayload(artifacts);
}

export function calculateFreshUntil(
  sourceType: CredentialVerificationSourceType,
  verifiedAt: string,
  stateLicenseFreshnessDays: number,
): string {
  if (sourceType === 'NPPES') {
    return addDays(verifiedAt, 30);
  }
  if (sourceType === 'OIG') {
    return addHours(verifiedAt, 24);
  }
  return addDays(verifiedAt, stateLicenseFreshnessDays);
}

export function isCredentialArtifactActive(
  artifact: CanonicalCredentialArtifact,
  now: Date = new Date(),
): boolean {
  if (!ACTIVE_STATUSES.has(artifact.status)) {
    return false;
  }

  if (!artifact.expires_at) {
    return true;
  }

  return Date.parse(artifact.expires_at) > now.getTime();
}
