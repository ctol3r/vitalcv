export type CredentialIngestionSourceName = 'npi-registry' | 'oig' | 'state-board';

export type CredentialVerificationSourceType = 'NPPES' | 'OIG' | 'STATE_BOARD';

export type CredentialVerificationMethod = 'API' | 'BULK_DOWNLOAD' | 'MOCK_ADAPTER';

export type CredentialArtifactType =
  | 'NPI_ENROLLMENT'
  | 'OIG_EXCLUSION'
  | 'STATE_LICENSE';

export type CredentialArtifactStatus =
  | 'ACTIVE'
  | 'VERIFIED'
  | 'DEACTIVATED'
  | 'CLEAR'
  | 'EXCLUDED'
  | 'CHECK_FAILED'
  | 'INACTIVE'
  | 'REVOKED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'NOT_FOUND'
  | 'NOT_AVAILABLE'
  | 'PENDING';

export interface CanonicalCredentialArtifact {
  kind: 'credential_artifact';
  subject_npi: string;
  source_name: CredentialIngestionSourceName;
  credential_type: CredentialArtifactType;
  issuer_org_id: string;
  credential_hash: string;
  issued_at: string;
  expires_at: string | null;
  status: CredentialArtifactStatus;
  metadata?: Record<string, unknown>;
}

export interface CanonicalVerificationArtifact {
  kind: 'verification_artifact';
  subject_npi: string;
  source_name: CredentialIngestionSourceName;
  related_credential_hash: string;
  source_type: CredentialVerificationSourceType;
  verification_method: CredentialVerificationMethod;
  evidence_hash: string;
  verified_at: string;
  fresh_until: string;
  payload_json: Record<string, unknown>;
}

export interface PersistableCanonicalArtifact<TArtifact> {
  id: string;
  artifact: TArtifact;
  signature: string;
  signatureAlgorithm: 'ES256';
  signatureIssuedAt: string;
}

export interface IngestionProviderProfile {
  npi: string;
  fullName: string;
  providerType: string;
  taxonomyCode: string;
  stateOfPractice: string;
}

export interface CompatibilityVerificationArtifactInput {
  npi: string;
  source: CredentialVerificationSourceType;
  status: string;
  checksum: string;
  rawPayload: CanonicalVerificationArtifact;
  verifiedAt: string;
  expiresAt: string | null;
  psvWindowStart: string;
  psvWindowDeadline: string;
  psvWindowCompliant: boolean;
  claimHashes: readonly string[];
}

export interface PersistIngestionBundleInput {
  sourceName: CredentialIngestionSourceName;
  rawPayloadHash: string;
  retrievedAt: string;
  runArtifactHash: string;
  provider: IngestionProviderProfile;
  credentialArtifact: PersistableCanonicalArtifact<CanonicalCredentialArtifact>;
  verificationArtifact: PersistableCanonicalArtifact<CanonicalVerificationArtifact>;
  compatibilityArtifact: CompatibilityVerificationArtifactInput;
}

export interface PersistedIngestionBundle {
  providerId: string;
  verificationRunId: string;
  credentialArtifactId: string;
  verificationArtifactId: string;
  compatibilityArtifactId: string;
  idempotent: boolean;
  credentialArtifact: CanonicalCredentialArtifact;
  verificationArtifact: CanonicalVerificationArtifact;
}

export interface ActiveCredentialArtifactRecord {
  artifactId: string;
  verificationRunId: string;
  artifact: CanonicalCredentialArtifact;
  createdAt: string;
}

export interface ActiveVerificationArtifactRecord {
  artifactId: string;
  verificationRunId: string;
  artifact: CanonicalVerificationArtifact;
  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCanonicalCredentialArtifact(value: unknown): value is CanonicalCredentialArtifact {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.kind === 'credential_artifact' &&
    typeof value.subject_npi === 'string' &&
    typeof value.source_name === 'string' &&
    typeof value.credential_type === 'string' &&
    typeof value.issuer_org_id === 'string' &&
    typeof value.credential_hash === 'string' &&
    typeof value.issued_at === 'string' &&
    (typeof value.expires_at === 'string' || value.expires_at === null) &&
    typeof value.status === 'string'
  );
}

export function isCanonicalVerificationArtifact(
  value: unknown,
): value is CanonicalVerificationArtifact {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.kind === 'verification_artifact' &&
    typeof value.subject_npi === 'string' &&
    typeof value.source_name === 'string' &&
    typeof value.related_credential_hash === 'string' &&
    typeof value.source_type === 'string' &&
    typeof value.verification_method === 'string' &&
    typeof value.evidence_hash === 'string' &&
    typeof value.verified_at === 'string' &&
    typeof value.fresh_until === 'string' &&
    isRecord(value.payload_json)
  );
}
