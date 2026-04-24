import { sha256Hex, stableStringify } from '../../../utils/deterministic';
import type {
  CredentialEnvelopePayload,
  IssuedCredentialResult,
  TrustContainerProviderKind,
  TrustContainerExportEnvironment,
} from './trustContainerContract';
import { CREDENTIAL_ENVELOPE_SCHEMA_VERSION } from './trustContainerContract';

/**
 * Public-facing description of a trust-container issuance as it appears
 * inside proof-pack manifests and audit events. Purposefully carries
 * only non-sensitive metadata — the VC itself is never inlined here.
 *
 * The entry is always present in the manifest (even when no credential
 * was issued) so downstream readers can distinguish "no issuance
 * happened" from "issuance succeeded but fields are missing".
 */
export interface TrustContainerManifestEntry {
  /** `issued` when a credential id exists; `not_issued` otherwise. */
  status: 'issued' | 'not_issued';
  /** Opaque credential id assigned by the provider. Null when skipped. */
  trustContainerId: string | null;
  /** Provider kind (`mock` | `dock`). Null when skipped. */
  provider: TrustContainerProviderKind | null;
  /** Export label that makes mock/dev and scaffold provenance explicit. */
  label: string;
  /** Non-production/scaffold environment label. Null when skipped. */
  environment: TrustContainerExportEnvironment | null;
  /** ISO-8601 issuance timestamp. Null when skipped. */
  issuedAt: string | null;
  /** Envelope schema version this manifest entry conforms to. */
  schemaVersion: typeof CREDENTIAL_ENVELOPE_SCHEMA_VERSION;
  /** sha256 hex of the canonical audit bundle the envelope attests to. */
  artifactHash: string | null;
  /** Explicit mirror of the envelope audit hash (same value as artifactHash). */
  auditHash: string | null;
  /** Proof tier the container committed to. */
  proofTier: CredentialEnvelopePayload['proofTier'] | null;
  /** Decision status the credential envelope committed to. */
  proofStatus: CredentialEnvelopePayload['status'] | null;
  /** Limitation notes preserved verbatim from the envelope. */
  limitationNotes: string[];
  /** True when the artifact came from a mock/scaffold provider. */
  mock: boolean;
  /** Human-readable reason when `status === 'not_issued'`. */
  skipReason?: string;
}

/**
 * Build a manifest entry from a successful issuance + envelope pair.
 * The entry mirrors envelope fields so verifiers can correlate the
 * audit hash and proof tier without having to dereference the VC.
 */
export function buildTrustContainerManifestEntry(params: {
  issuance: IssuedCredentialResult;
  envelope: CredentialEnvelopePayload;
  provider: TrustContainerProviderKind;
}): TrustContainerManifestEntry {
  const { issuance, envelope, provider } = params;
  const environment: TrustContainerExportEnvironment =
    issuance.mock === true || provider === 'mock' ? 'mock-dev' : 'dock-scaffold';
  return {
    status: 'issued',
    trustContainerId: issuance.id,
    provider,
    label:
      environment === 'mock-dev'
        ? 'Mock/dev credential container'
        : 'Dock scaffold credential container',
    environment,
    issuedAt: issuance.issuedAt,
    schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
    artifactHash: envelope.auditHash,
    auditHash: envelope.auditHash,
    proofTier: envelope.proofTier,
    proofStatus: envelope.status,
    limitationNotes: [...envelope.limitationNotes],
    mock: issuance.mock === true,
  };
}

/**
 * Build the "no issuance happened" manifest entry. Explicit is better
 * than silently dropping the field — downstream readers then know the
 * container path was exercised (and skipped) rather than missing.
 */
export function trustContainerNotIssuedEntry(
  skipReason: string,
): TrustContainerManifestEntry {
  return {
    status: 'not_issued',
    trustContainerId: null,
    provider: null,
    label: 'Credential container: not issued',
    environment: null,
    issuedAt: null,
    schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
    artifactHash: null,
    auditHash: null,
    proofTier: null,
    proofStatus: null,
    limitationNotes: [],
    mock: false,
    skipReason,
  };
}

/** Compact view used by ARTIFACT_EXPORTED audit metadata. */
export interface TrustContainerAuditMetadata {
  status: TrustContainerManifestEntry['status'];
  trustContainerId: string | null;
  provider: TrustContainerProviderKind | null;
  label: string;
  environment: TrustContainerManifestEntry['environment'];
  proofTier: CredentialEnvelopePayload['proofTier'] | null;
  proofStatus: CredentialEnvelopePayload['status'] | null;
  mock: boolean;
  auditHash: string | null;
  skipReason?: string;
}

export function toTrustContainerAuditMetadata(
  entry: TrustContainerManifestEntry,
): TrustContainerAuditMetadata {
  return {
    status: entry.status,
    trustContainerId: entry.trustContainerId,
    provider: entry.provider,
    label: entry.label,
    environment: entry.environment,
    proofTier: entry.proofTier,
    proofStatus: entry.proofStatus,
    mock: entry.mock,
    auditHash: entry.auditHash,
    ...(entry.skipReason ? { skipReason: entry.skipReason } : {}),
  };
}

/** Verifier-safe label for UIs and READMEs. Defensive against missing entries. */
export function trustContainerDisplayLabel(
  entry: TrustContainerManifestEntry | null | undefined,
): string {
  if (!entry) return 'Credential container: not issued';
  return entry.label;
}

/** Deterministic fingerprint — useful for audit trails that want drift detection. */
export function fingerprintTrustContainerEntry(entry: TrustContainerManifestEntry): string {
  return sha256Hex(stableStringify(entry));
}
