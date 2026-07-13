/**
 * Trust Container Contract
 *
 * Backend-only abstraction between VitalCV services and a verifiable
 * credential substrate. Dock is one provider implementation; the shared
 * contract stays provider-neutral so future providers can satisfy the same
 * boundary without changing proof-pack callers.
 */

export const CREDENTIAL_ENVELOPE_SCHEMA_VERSION = '1.0.0' as const;

export type TrustContainerProviderKind = 'dock' | 'mock' | 'vitalcv';

export type ProofTier = 'DECISION_GRADE' | 'PARTIAL' | 'SNAPSHOT' | 'NONE';

export type ProofStatus = 'DECISION_GRADE' | 'PARTIAL' | 'BLOCKED';

export type TrustContainerExportEnvironment = 'mock-dev' | 'dock-scaffold' | 'vitalcv-signed';

export interface TrustContainerConfig {
  provider: TrustContainerProviderKind;
  apiUrl?: string;
  apiKey?: string;
  issuerDid?: string;
  network?: string;
}

export interface IssuerMetadata {
  did: string;
  name: string;
  endpoint?: string;
  provider: TrustContainerProviderKind;
}

export interface FreshnessDescriptor {
  label: 'REAL_TIME' | 'FRESH' | 'AGING' | 'STALE';
  evidenceAsOf: string;
  ttlSeconds: number;
}

export interface PsvReceiptRef {
  receiptId: string;
  source: string;
  verifiedAt: string;
  checksum: string;
}

export interface CredentialSubject {
  npi: string;
  entityId: string;
  displayName?: string;
  did?: string;
}

export interface CredentialEnvelopePayload {
  entityId: string;
  subject: CredentialSubject;
  clinicianNpi: string;
  sourceCoverage: string[];
  psvReceiptRefs: PsvReceiptRef[];
  proofTier: ProofTier;
  freshness: FreshnessDescriptor;
  limitationNotes: string[];
  auditHash: string;
  issuer: IssuerMetadata;
  schemaVersion: typeof CREDENTIAL_ENVELOPE_SCHEMA_VERSION;
  status: ProofStatus;
}

export interface IssuedCredentialResult {
  id: string;
  did: string;
  vcPayload: unknown;
  issuedAt: string;
  envelopeHash: string;
  mock?: boolean;
}

export interface TrustContainerExportReference {
  trustContainerId: string;
  provider: TrustContainerProviderKind;
  environment: TrustContainerExportEnvironment;
  label: string;
  mock: boolean;
  status: ProofStatus;
  proofTier: ProofTier;
  issuedAt: string;
  envelopeHash: string;
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  envelopeHash?: string;
  mock?: boolean;
}

export interface AnchorReceiptResult {
  receiptId: string;
  anchoredAt: string;
  txHash: string;
  mock?: boolean;
}

export interface PresentationResult {
  vpPayload: unknown;
  mock?: boolean;
}

export interface DidDocument {
  did: string;
  document: { id: string; [key: string]: unknown };
  mock?: boolean;
}

export interface ProofBundleExport {
  entityId: string;
  bundle: unknown[];
  mock?: boolean;
}

export interface HealthCheckResult {
  ok: boolean;
  status: string;
  reason?: string;
}

export interface TrustContainerProvider {
  readonly kind: TrustContainerProviderKind;
  healthCheck(): Promise<HealthCheckResult>;
  issueCredential(payload: CredentialEnvelopePayload): Promise<IssuedCredentialResult>;
  verifyCredential(vc: unknown): Promise<VerificationResult>;
  anchorReceipt(receiptData: unknown): Promise<AnchorReceiptResult>;
  createPresentation(vcs: unknown[]): Promise<PresentationResult>;
  resolveDid(did: string): Promise<DidDocument>;
  exportProofBundle(entityId: string): Promise<ProofBundleExport>;
}

export class TrustContainerProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'MISSING_CONFIG'
      | 'LIMITATION_CONFLICT'
      | 'PROVIDER_UNAVAILABLE'
      | 'INVALID_ENVELOPE',
  ) {
    super(message);
    this.name = 'TrustContainerProviderError';
  }
}

export function assertLimitationConsistency(payload: CredentialEnvelopePayload): void {
  if (payload.status === 'DECISION_GRADE' && payload.limitationNotes.length > 0) {
    throw new TrustContainerProviderError(
      `Cannot issue DECISION_GRADE credential while limitations exist: ${payload.limitationNotes.join('; ')}`,
      'LIMITATION_CONFLICT',
    );
  }

  if (payload.status === 'DECISION_GRADE' && payload.proofTier !== 'DECISION_GRADE') {
    throw new TrustContainerProviderError(
      `status=DECISION_GRADE requires proofTier=DECISION_GRADE (got ${payload.proofTier})`,
      'INVALID_ENVELOPE',
    );
  }

  if (payload.status !== 'DECISION_GRADE' && payload.proofTier === 'DECISION_GRADE') {
    throw new TrustContainerProviderError(
      `proofTier=DECISION_GRADE requires status=DECISION_GRADE (got ${payload.status})`,
      'INVALID_ENVELOPE',
    );
  }

  if (payload.schemaVersion !== CREDENTIAL_ENVELOPE_SCHEMA_VERSION) {
    throw new TrustContainerProviderError(
      `Unsupported envelope schemaVersion: ${payload.schemaVersion}`,
      'INVALID_ENVELOPE',
    );
  }
}
