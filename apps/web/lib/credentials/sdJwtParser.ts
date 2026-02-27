import { decodeJwt } from 'jose';

import type {
  CredentialState,
  HolderCredential,
  TrustLevel,
} from '@/types/holder';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ParsedSdJwt {
  rawJwt: string;
  issuer: string;
  vct: string;
  issuedAt: string;
  expiresAt: string | null;
  subject: string | null;
  claims: Record<string, unknown>;
  disclosures: string[];
}

/* ------------------------------------------------------------------ */
/*  parseCredentialPayload                                             */
/* ------------------------------------------------------------------ */

/**
 * Decode an SD-JWT compact string into structured fields.
 * Does NOT verify the signature — display-only.
 */
export function parseCredentialPayload(rawToken: string): ParsedSdJwt {
  const parts = rawToken.split('~');
  const jwtPart = parts[0];
  const disclosures = parts.slice(1).filter(Boolean);

  const payload = decodeJwt(jwtPart);

  const iat =
    typeof payload.iat === 'number'
      ? new Date(payload.iat * 1000).toISOString()
      : new Date().toISOString();

  const exp =
    typeof payload.exp === 'number'
      ? new Date(payload.exp * 1000).toISOString()
      : null;

  // Collect all claims except standard JWT registered fields
  const reserved = new Set(['iss', 'sub', 'vct', 'iat', 'exp', '_sd', '_sd_alg']);
  const claims: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!reserved.has(k)) claims[k] = v;
  }

  return {
    rawJwt: jwtPart,
    issuer: (payload.iss as string) ?? 'unknown',
    vct: (payload as Record<string, unknown>).vct as string ?? 'Credential',
    issuedAt: iat,
    expiresAt: exp,
    subject: (payload.sub as string) ?? null,
    claims,
    disclosures,
  };
}

/* ------------------------------------------------------------------ */
/*  parsedToHolderCredential                                           */
/* ------------------------------------------------------------------ */

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

function deriveType(vct: string): string {
  const lower = vct.toLowerCase();
  if (lower.includes('license') || lower.includes('medical')) return 'STATE_LICENSE';
  if (lower.includes('dea')) return 'DEA_REGISTRATION';
  if (lower.includes('board')) return 'BOARD_CERTIFICATION';
  if (lower.includes('npi')) return 'NPI_ENROLLMENT';
  return 'CREDENTIAL';
}

function humanLabel(vct: string): string {
  // Split camelCase → spaced words
  return vct.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function parsedToHolderCredential(parsed: ParsedSdJwt): HolderCredential {
  const c = parsed.claims;

  const stateRaw = typeof c.status === 'string' ? c.status : 'valid';
  const state: CredentialState =
    stateRaw === 'valid' || stateRaw === 'expiring' || stateRaw === 'revoked'
      ? stateRaw
      : 'valid';

  const trustRaw = typeof c.trustLevel === 'string' ? c.trustLevel : 'L2';
  const trustLevel: TrustLevel =
    trustRaw === 'L0' || trustRaw === 'L1' || trustRaw === 'L2' || trustRaw === 'L3'
      ? trustRaw
      : 'L2';

  return {
    id: parsed.subject ?? crypto.randomUUID(),
    type: deriveType(parsed.vct),
    name: humanLabel(parsed.vct),
    issuer: parsed.issuer,
    state,
    trustLevel,
    issueDate: formatDate(parsed.issuedAt),
    expirationDate: parsed.expiresAt ? formatDate(parsed.expiresAt) : undefined,
    holderName: typeof c.holderName === 'string' ? c.holderName : undefined,
    licenseNumber: typeof c.licenseNumber === 'string' ? c.licenseNumber : undefined,
    npi: typeof c.npi === 'string' ? c.npi : undefined,
    scope: typeof c.scope === 'string' ? c.scope : undefined,
    verifierDID: typeof c.verifierDID === 'string' ? c.verifierDID : undefined,
    methodologyVersion:
      typeof c.methodologyVersion === 'string' ? c.methodologyVersion : undefined,
    rawSnapshotHash:
      typeof c.rawSnapshotHash === 'string' ? c.rawSnapshotHash : undefined,
    auditTrail: [],
  };
}
