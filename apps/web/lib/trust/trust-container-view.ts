export type TrustContainerIssuanceStatus = 'issued' | 'not_issued' | 'failed';
export type TrustContainerProviderKind = 'mock' | 'dock' | 'vitalcv';
export type TrustContainerEnvironment = 'mock-dev' | 'dock-scaffold' | 'vitalcv-signed';
export type TrustContainerProofTier = 'DECISION_GRADE' | 'PARTIAL' | 'SNAPSHOT' | 'NONE';
export type TrustContainerProofStatus = 'DECISION_GRADE' | 'PARTIAL' | 'BLOCKED';

export interface TrustContainerManifestView {
  status: TrustContainerIssuanceStatus;
  trustContainerId: string | null;
  credentialEnvelopeId: string | null;
  provider: TrustContainerProviderKind | null;
  label: string;
  environment: TrustContainerEnvironment | null;
  issuedAt: string | null;
  schemaVersion: string;
  artifactHash: string | null;
  auditHash: string | null;
  proofTier: TrustContainerProofTier | null;
  proofStatus: TrustContainerProofStatus | null;
  limitationNotes: string[];
  mock: boolean;
  skipReason?: string;
}

type UnknownRecord = Record<string, unknown>;

const FORBIDDEN_TRUST_CONTAINER_KEYS = new Set([
  'apikey',
  'dockapikey',
  'privatekey',
  'secret',
  'token',
  'bearertoken',
  'authorization',
  'cookie',
  'password',
]);

const SECRET_VALUE_PATTERNS = [
  /\b(api[_-]?key|private[_-]?key|secret|password|authorization)\s*[:=]\s*[^,\s;]+/i,
  /\bbearer\s+[A-Za-z0-9._-]{8,}/i,
  /\b(sk|pk|dock)_[A-Za-z0-9_-]{8,}\b/i,
] as const;

const VERIFIER_OVERCLAIM_PATTERNS = [
  /blockchain(?:-anchored| verified)?/gi,
  /\bon[- ]chain(?: proof| claim)?\b/gi,
  /zero[- ]knowledge(?: proof)?/gi,
  /zero[- ]trust ledger/gi,
  /\bledger\b/gi,
  /hire instantly/gi,
  /instant hire/gi,
  /wallet ready/gi,
  /fully verified/gi,
  /guaranteed/gi,
  /legally accepted/gi,
  /risk transferred/gi,
  /complete credentialing/gi,
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null | undefined {
  return typeof value === 'string' || value === null || typeof value === 'undefined';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isProvider(value: unknown): value is TrustContainerProviderKind {
  return value === 'mock' || value === 'dock' || value === 'vitalcv';
}

function isNullableProvider(value: unknown): value is TrustContainerProviderKind | null | undefined {
  return value === null || typeof value === 'undefined' || isProvider(value);
}

function isEnvironment(value: unknown): value is TrustContainerEnvironment {
  return value === 'mock-dev' || value === 'dock-scaffold' || value === 'vitalcv-signed';
}

function isNullableEnvironment(value: unknown): value is TrustContainerEnvironment | null | undefined {
  return value === null || typeof value === 'undefined' || isEnvironment(value);
}

function isProofTier(value: unknown): value is TrustContainerProofTier {
  return value === 'DECISION_GRADE' || value === 'PARTIAL' || value === 'SNAPSHOT' || value === 'NONE';
}

function isNullableProofTier(value: unknown): value is TrustContainerProofTier | null | undefined {
  return value === null || typeof value === 'undefined' || isProofTier(value);
}

function isProofStatus(value: unknown): value is TrustContainerProofStatus {
  return value === 'DECISION_GRADE' || value === 'PARTIAL' || value === 'BLOCKED';
}

function isNullableProofStatus(value: unknown): value is TrustContainerProofStatus | null | undefined {
  return value === null || typeof value === 'undefined' || isProofStatus(value);
}

function hasSecretValue(value: string): boolean {
  const withoutKnownRedactions = value.replace(
    /\b(api[_-]?key|private[_-]?key|secret|password|authorization)\s*[:=]\s*\[redacted\]/gi,
    '',
  );
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(withoutKnownRedactions));
}

function normalizedKey(key: string): string {
  return key.replace(/[-_]/g, '').toLowerCase();
}

export function hasForbiddenTrustContainerMaterial(value: unknown): boolean {
  if (typeof value === 'string') {
    return hasSecretValue(value);
  }

  if (Array.isArray(value)) {
    return value.some(hasForbiddenTrustContainerMaterial);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, nested]) => (
    FORBIDDEN_TRUST_CONTAINER_KEYS.has(normalizedKey(key))
    || hasForbiddenTrustContainerMaterial(nested)
  ));
}

export function normalizeTrustContainerManifestView(
  value: unknown,
): TrustContainerManifestView | null {
  if (!isRecord(value) || hasForbiddenTrustContainerMaterial(value)) {
    return null;
  }

  if (
    !(value.status === 'issued' || value.status === 'not_issued' || value.status === 'failed')
    || !isNullableString(value.trustContainerId)
    || !isNullableString(value.credentialEnvelopeId)
    || !isNullableProvider(value.provider)
    || !isString(value.label)
    || !isNullableEnvironment(value.environment)
    || !isNullableString(value.issuedAt)
    || !isString(value.schemaVersion)
    || !isNullableString(value.artifactHash)
    || !isNullableString(value.auditHash)
    || !isNullableProofTier(value.proofTier)
    || !isNullableProofStatus(value.proofStatus)
    || !isStringArray(value.limitationNotes)
    || typeof value.mock !== 'boolean'
    || !isNullableString(value.skipReason)
  ) {
    return null;
  }

  return {
    status: value.status,
    trustContainerId: value.trustContainerId ?? null,
    credentialEnvelopeId: value.credentialEnvelopeId ?? null,
    provider: value.provider ?? null,
    label: value.label,
    environment: value.environment ?? null,
    issuedAt: value.issuedAt ?? null,
    schemaVersion: value.schemaVersion,
    artifactHash: value.artifactHash ?? null,
    auditHash: value.auditHash ?? null,
    proofTier: value.proofTier ?? null,
    proofStatus: value.proofStatus ?? null,
    limitationNotes: [...value.limitationNotes],
    mock: value.mock,
    ...(value.skipReason ? { skipReason: value.skipReason } : {}),
  };
}

export function sanitizeTrustContainerDisplayText(value: string): string {
  let safe = value
    .replace(/\b(api[_-]?key|private[_-]?key|secret|password|authorization)\s*[:=]\s*[^,\s;]+/gi, '$1=[redacted]')
    .replace(/\bbearer\s+[A-Za-z0-9._-]{8,}/gi, 'bearer [redacted]')
    .replace(/\b(sk|pk|dock)_[A-Za-z0-9_-]{8,}\b/gi, '[redacted]')
    .replace(/\b[a-f0-9]{48,}\b/gi, '[redacted reference]');

  for (const pattern of VERIFIER_OVERCLAIM_PATTERNS) {
    safe = safe.replace(pattern, '[unsupported claim]');
  }

  return safe;
}
