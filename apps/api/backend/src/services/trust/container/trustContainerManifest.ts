import { sha256Hex, stableStringify } from '../../../utils/deterministic';
import type {
  CredentialEnvelopePayload,
  IssuedCredentialResult,
  TrustContainerProviderKind,
  TrustContainerExportEnvironment,
} from './trustContainerContract';
import { CREDENTIAL_ENVELOPE_SCHEMA_VERSION } from './trustContainerContract';

function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(api[_-]?key|private[_-]?key|secret|token)\s*[:=]\s*[^,\s;]+/gi, '$1=[redacted]')
    .replace(/\b(sk|pk|dock)_[A-Za-z0-9_-]{8,}\b/g, '[redacted]');
}

/**
 * Public-facing description of a trust-container issuance as it appears
 * inside proof-pack manifests and audit events. Purposefully carries
 * only non-sensitive metadata — the VC itself is never inlined here, and
 * nothing from the Dock config (api key, issuer DID secrets) is allowed
 * onto this shape. See `assertTrustContainerManifestHasNoSecrets` for
 * the enforcement path.
 *
 * The entry is always present in the manifest so downstream readers can
 * distinguish "no issuance happened" from "field missing".
 *
 * Status values:
 *   - `issued`    — a credential id exists and the envelope was accepted.
 *   - `not_issued` — issuance was skipped by policy (no provider,
 *                    export path disabled, etc.).
 *   - `failed`    — issuance was attempted and errored; we still surface
 *                   the skip reason so the export audit captures *why*.
 */
export type TrustContainerIssuanceStatus = 'issued' | 'not_issued' | 'failed';

export interface TrustContainerManifestEntry {
  status: TrustContainerIssuanceStatus;
  trustContainerId: string | null;
  /**
   * Deterministic envelope hash reported by the provider. Useful for
   * verifiers that want to correlate a manifest back to the exact
   * envelope without seeing the VC. Null when not issued.
   */
  credentialEnvelopeId: string | null;
  provider: TrustContainerProviderKind | null;
  label: string;
  environment: TrustContainerExportEnvironment | null;
  issuedAt: string | null;
  schemaVersion: typeof CREDENTIAL_ENVELOPE_SCHEMA_VERSION;
  artifactHash: string | null;
  auditHash: string | null;
  proofTier: CredentialEnvelopePayload['proofTier'] | null;
  proofStatus: CredentialEnvelopePayload['status'] | null;
  limitationNotes: string[];
  mock: boolean;
  /** Human-readable reason for non-success states. */
  skipReason?: string;
}

export function buildTrustContainerManifestEntry(params: {
  issuance: IssuedCredentialResult;
  envelope: CredentialEnvelopePayload;
  provider: TrustContainerProviderKind;
}): TrustContainerManifestEntry {
  const { issuance, envelope, provider } = params;
  const environment: TrustContainerExportEnvironment =
    issuance.mock === true || provider === 'mock' ? 'mock-dev' : 'dock-scaffold';
  const hasLimitations = envelope.limitationNotes.length > 0;
  const proofStatus: CredentialEnvelopePayload['status'] =
    hasLimitations && envelope.status === 'DECISION_GRADE' ? 'PARTIAL' : envelope.status;
  const proofTier: CredentialEnvelopePayload['proofTier'] =
    proofStatus !== 'DECISION_GRADE' && envelope.proofTier === 'DECISION_GRADE'
      ? 'PARTIAL'
      : envelope.proofTier;

  return {
    status: 'issued',
    trustContainerId: issuance.id,
    credentialEnvelopeId: issuance.envelopeHash,
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
    proofTier,
    proofStatus,
    limitationNotes: [...envelope.limitationNotes],
    mock: issuance.mock === true || provider === 'mock',
  };
}

/**
 * Build the "issuance was skipped by policy" entry. Explicit is better
 * than silently dropping the field — downstream readers then know the
 * container path was exercised (and skipped) rather than missing.
 */
export function trustContainerNotIssuedEntry(
  skipReason: string,
): TrustContainerManifestEntry {
  return {
    status: 'not_issued',
    trustContainerId: null,
    credentialEnvelopeId: null,
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
    skipReason: redactSensitiveText(skipReason),
  };
}

/**
 * Build the "issuance was attempted and failed" entry. Carries the
 * provider kind (if known) so observability can filter mock-path
 * failures from real ones.
 */
export function trustContainerFailedEntry(params: {
  reason: string;
  provider?: TrustContainerProviderKind | null;
}): TrustContainerManifestEntry {
  const provider = params.provider ?? null;
  const environment: TrustContainerExportEnvironment | null = provider
    ? provider === 'mock'
      ? 'mock-dev'
      : 'dock-scaffold'
    : null;
  return {
    status: 'failed',
    trustContainerId: null,
    credentialEnvelopeId: null,
    provider,
    label: 'Credential container: issuance failed',
    environment,
    issuedAt: null,
    schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
    artifactHash: null,
    auditHash: null,
    proofTier: null,
    proofStatus: null,
    limitationNotes: [],
    mock: provider === 'mock',
    skipReason: redactSensitiveText(params.reason),
  };
}

export interface TrustContainerAuditMetadata {
  status: TrustContainerManifestEntry['status'];
  trustContainerId: string | null;
  credentialEnvelopeId: string | null;
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
    credentialEnvelopeId: entry.credentialEnvelopeId,
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

export function trustContainerDisplayLabel(
  entry: TrustContainerManifestEntry | null | undefined,
): string {
  if (!entry) return 'Credential container: not issued';
  if (entry.status === 'failed') return 'Credential container: issuance failed';
  return entry.label;
}

export function fingerprintTrustContainerEntry(entry: TrustContainerManifestEntry): string {
  return sha256Hex(stableStringify(entry));
}

/**
 * Fields that must never appear in manifest or audit payloads. This is
 * a defence-in-depth guard — the TrustContainerManifestEntry type does
 * not have slots for these, but a careless caller could still splat
 * them in.
 */
const FORBIDDEN_MANIFEST_KEYS = [
  'apiKey',
  'api_key',
  'dockApiKey',
  'DOCK_API_KEY',
  'privateKey',
  'private_key',
  'secret',
  'bearerToken',
  'authorization',
  'cookie',
  'password',
] as const;

/**
 * Assert that a manifest entry (or any JSON-serializable value derived
 * from it) does not contain secret material. Intended for the proof-pack
 * export path to fail loudly if the shape drifts.
 */
export function assertTrustContainerManifestHasNoSecrets(value: unknown): void {
  const canonical = stableStringify(value);
  for (const key of FORBIDDEN_MANIFEST_KEYS) {
    const needle = `"${key}"`;
    if (canonical.includes(needle)) {
      throw new Error(
        `Trust container manifest must not expose secret material (found "${key}")`,
      );
    }
  }
}
