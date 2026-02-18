export const DEFAULT_ISSUER_DID = 'did:web:vitalcv.com';

export function normalizeDid(rawDid: string): string {
  const normalized = rawDid.trim();
  return normalized;
}

export function getConfiguredIssuerDid(): string {
  const configured = process.env.ISSUER_DID?.trim() ?? '';
  return configured.length > 0 ? configured : DEFAULT_ISSUER_DID;
}

export function assertExpectedIssuerDid(candidate: string): void {
  const normalized = normalizeDid(candidate);
  const expected = getConfiguredIssuerDid();
  if (normalized !== expected) {
    throw new Error(`Issuer DID mismatch: expected ${expected}, received ${normalized}`);
  }
}

export function isValidDidFormat(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('did:');
}
