import type {
  TrustStateCredentialArtifact,
  TrustStateVerificationArtifact,
} from './contracts';

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_HEX = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = value.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return undefined;
}

function readRequiredString(
  record: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): string {
  const value = readOptionalString(record, keys);
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
}

function assertSha256Hex(value: string, label: string): void {
  if (!SHA256_HEX.test(value)) {
    throw new Error(`${label} must be a SHA-256 hex string`);
  }
}

function assertRfc3339Utc(value: string, label: string): void {
  if (!RFC3339_UTC.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an RFC3339 UTC timestamp`);
  }
}

export function validateCredentialArtifact(value: unknown): TrustStateCredentialArtifact {
  if (!isRecord(value)) {
    throw new Error('credential artifact must be an object');
  }

  const source = readRequiredString(value, ['source', 'source_name', 'sourceName'], 'source');
  const credential_hash = readRequiredString(
    value,
    ['credential_hash', 'credentialHash'],
    'credential hash',
  );

  assertSha256Hex(credential_hash, 'credential hash');

  return Object.freeze({
    ...(typeof value.id === 'string' && value.id.trim().length > 0 ? { id: value.id.trim() } : {}),
    source,
    credential_hash: credential_hash.toLowerCase(),
  });
}

export function validateVerificationArtifact(value: unknown): TrustStateVerificationArtifact {
  if (!isRecord(value)) {
    throw new Error('verification artifact must be an object');
  }

  const source = readRequiredString(value, ['source', 'source_name', 'sourceName'], 'source');
  const verification_method = readRequiredString(
    value,
    ['verification_method', 'verificationMethod'],
    'verification method',
  );
  const fresh_until = readRequiredString(
    value,
    ['fresh_until', 'freshUntil', 'freshness_window', 'freshnessWindow'],
    'freshness window',
  );
  const evidence_hash = readRequiredString(
    value,
    ['evidence_hash', 'evidenceHash'],
    'evidence hash',
  );
  const related_credential_hash = readOptionalString(
    value,
    ['related_credential_hash', 'relatedCredentialHash'],
  );

  assertRfc3339Utc(fresh_until, 'freshness window');
  assertSha256Hex(evidence_hash, 'evidence hash');
  if (related_credential_hash) {
    assertSha256Hex(related_credential_hash, 'related credential hash');
  }

  return Object.freeze({
    ...(typeof value.id === 'string' && value.id.trim().length > 0 ? { id: value.id.trim() } : {}),
    source,
    ...(related_credential_hash
      ? { related_credential_hash: related_credential_hash.toLowerCase() }
      : {}),
    verification_method,
    fresh_until,
    evidence_hash: evidence_hash.toLowerCase(),
  });
}
