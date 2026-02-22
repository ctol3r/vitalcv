import type { VerificationResult } from '../interfaces/verificationSource';
import type { CanonicalClaim } from '../utils/claimHash';
import { hashClaim } from '../utils/claimHash';

type CanonicalClaimSource = {
  npi: string;
  status: string;
  rawPayload: unknown;
};

type AddClaimContext = Map<string, string | number | boolean | null>;

type CanonicalPrimitive = string | number | boolean | null;

export interface ClaimDigest {
  type: string;
  value: string;
  hash: string;
}

export interface SelectiveDisclosurePlaceholder {
  algorithm: 'SD-JWT';
  hashAlgorithm: 'sha-256';
  _sd: string[];
  claims: Array<{
    type: string;
    hash: string;
  }>;
}

function addCanonicalClaim(
  claims: AddClaimContext,
  type: string,
  value: CanonicalPrimitive,
): void {
  const normalizedType = type.trim();
  if (normalizedType.length === 0) {
    return;
  }

  const normalizedValue = String(value);
  const existingValue = claims.get(normalizedType);
  if (existingValue !== undefined) {
    if (existingValue !== normalizedValue) {
      throw new Error(`Conflicting canonical claim values for type "${normalizedType}"`);
    }
    return;
  }

  claims.set(normalizedType, normalizedValue);
}

function addPrimitiveClaim(
  claims: AddClaimContext,
  type: string,
  value: unknown,
): void {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    addCanonicalClaim(claims, type, value);
  }
}

function collectRawClaims(
  claims: AddClaimContext,
  rawPayload: unknown,
): void {
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return;
  }

  const rawEntries = Object.entries(rawPayload as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [type, value] of rawEntries) {
    if (type.length === 0) {
      continue;
    }

    if (value instanceof Date) {
      addCanonicalClaim(claims, type, value.toISOString());
      continue;
    }

    addPrimitiveClaim(claims, type, value);
  }
}

function buildClaimsFromNpiAndPayload(source: CanonicalClaimSource): CanonicalClaim[] {
  const claims = new Map<string, string>();

  addCanonicalClaim(claims, 'npi', source.npi);
  addCanonicalClaim(claims, 'licenseStatus', source.status);
  collectRawClaims(claims, source.rawPayload);

  return [...claims.entries()].map(([type, value]) => ({ type, value }));
}

export function buildCanonicalClaimsFromVerificationResult(
  npi: string,
  result: VerificationResult,
): CanonicalClaim[] {
  const claims: CanonicalClaimSource = {
    npi,
    status: result.licenseStatus,
    rawPayload: result.rawPayload,
  };

  const canonicalClaims = buildClaimsFromNpiAndPayload(claims);

  const withKnownFields = [...canonicalClaims];
  const claimMap = new Map(withKnownFields.map((claim) => [claim.type, claim.value]));

  addCanonicalClaim(claimMap, 'jurisdiction', result.jurisdiction);
  addCanonicalClaim(claimMap, 'sourceUrl', result.sourceUrl);
  addCanonicalClaim(claimMap, 'lastUpdated', result.lastUpdated.toISOString());
  addCanonicalClaim(claimMap, 'expirationDate', result.expirationDate ? result.expirationDate.toISOString() : null);

  return [...claimMap.entries()].map(([type, value]) => ({ type, value }));
}

export function buildCanonicalClaimsFromArtifact({
  npi,
  status,
  rawPayload,
}: CanonicalClaimSource): CanonicalClaim[] {
  const claims = new Map<string, string>();
  const source = { npi, status, rawPayload };

  addCanonicalClaim(claims, 'npi', npi);
  addCanonicalClaim(claims, 'licenseStatus', status);

  let jurisdiction: unknown;
  let sourceUrl: unknown;
  let lastUpdated: unknown;
  let expirationDate: unknown;

  if (rawPayload !== null && typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
    const payload = rawPayload as Record<string, unknown>;
    jurisdiction = payload.jurisdiction;
    sourceUrl = payload.sourceUrl;
    lastUpdated = payload.lastUpdated;
    expirationDate = payload.expirationDate;
  }

  if (typeof jurisdiction === 'string') {
    addCanonicalClaim(claims, 'jurisdiction', jurisdiction);
  }
  addCanonicalClaim(
    claims,
    'sourceUrl',
    typeof sourceUrl === 'string' ? sourceUrl : `https://www.nursys.com/LLV/LLVVerification.aspx?npi=${npi}`,
  );
  if (typeof lastUpdated === 'string') {
    addCanonicalClaim(claims, 'lastUpdated', lastUpdated);
  }
  if (typeof expirationDate === 'string') {
    addCanonicalClaim(claims, 'expirationDate', expirationDate);
  } else {
    addCanonicalClaim(claims, 'expirationDate', null);
  }

  collectRawClaims(claims, rawPayload);

  return [...claims.entries()].map(([type, value]) => ({ type, value }));
}

export function buildClaimDigests(claims: readonly CanonicalClaim[]): ClaimDigest[] {
  return claims.map((claim) => ({
    type: claim.type,
    value: String(claim.value),
    hash: hashClaim({ type: claim.type, value: claim.value }),
  }));
}

export function buildSelectiveDisclosurePlaceholder(claims: readonly CanonicalClaim[]): SelectiveDisclosurePlaceholder {
  const digests = buildClaimDigests(claims);
  const sortedDigests = [...digests].sort((left, right) => left.hash.localeCompare(right.hash));

  return {
    algorithm: 'SD-JWT',
    hashAlgorithm: 'sha-256',
    _sd: sortedDigests.map((entry) => entry.hash),
    claims: sortedDigests.map((entry) => ({
      type: entry.type,
      hash: entry.hash,
    })),
  };
}
