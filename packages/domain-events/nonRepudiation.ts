import crypto from 'crypto';
import { CanonicalPrimitiveError } from '@vitalcv/domain-core';

export type SignatureProof = Readonly<{
  type: string;
  verificationMethod: string;
  proofValue: string;
}>;

const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function assertNonEmptyField(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CanonicalPrimitiveError(`${field} is required`, 'MISSING_FIELD', { field });
  }
}

export function assertValidProof(value: unknown, field = 'proof'): asserts value is SignatureProof {
  if (!value || typeof value !== 'object') {
    throw new CanonicalPrimitiveError(`${field} is required`, 'MISSING_FIELD', { field });
  }

  const candidate = value as Record<string, unknown>;
  assertNonEmptyField(candidate.type, `${field}.type`);
  assertNonEmptyField(candidate.verificationMethod, `${field}.verificationMethod`);
  assertNonEmptyField(candidate.proofValue, `${field}.proofValue`);
}

export function normalizeProof(value: SignatureProof): SignatureProof {
  return Object.freeze({
    type: value.type.trim(),
    verificationMethod: value.verificationMethod.trim(),
    proofValue: value.proofValue.trim(),
  });
}

export function buildHashAnchor(payload: Readonly<Record<string, unknown>>): string {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export function assertHashAnchor(
  providedHashAnchor: string | undefined,
  canonicalPayload: Readonly<Record<string, unknown>>,
): string {
  const computed = buildHashAnchor(canonicalPayload);
  if (providedHashAnchor === undefined) {
    return computed;
  }

  if (!SHA256_HEX_REGEX.test(providedHashAnchor)) {
    throw new CanonicalPrimitiveError('hashAnchor must be a sha256 hex digest', 'INVALID_FIELD', {
      hashAnchor: providedHashAnchor,
    });
  }

  if (providedHashAnchor.toLowerCase() !== computed) {
    throw new CanonicalPrimitiveError('hashAnchor does not match canonical payload', 'INVALID_FIELD', {
      hashAnchor: providedHashAnchor,
      expectedHashAnchor: computed,
    });
  }

  return providedHashAnchor.toLowerCase();
}
