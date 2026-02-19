const FALLBACK_ISSUER_DID = 'did:web:vitalcv.com';

function normalizeDidCandidate(rawDid: string | undefined): string {
  const trimmed = rawDid?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : FALLBACK_ISSUER_DID;
}

export function generateIssuerDID(): string {
  return normalizeDidCandidate(process.env.ISSUER_DID);
}

export function getControlledIssuerDID(): string {
  return generateIssuerDID();
}
