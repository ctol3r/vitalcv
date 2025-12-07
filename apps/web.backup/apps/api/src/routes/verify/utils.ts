export interface NormalizedCredentialEntry {
  format: 'sd-jwt' | 'jwt-vc';
  token: string;
  disclosures?: Array<Record<string, any>>;
  revealGroups?: string[];
}

export function normalizeCredentialEntries(vp: any): NormalizedCredentialEntry[] {
  if (!vp?.verifiableCredential) {
    return [];
  }

  const entries = Array.isArray(vp.verifiableCredential)
    ? vp.verifiableCredential
    : [vp.verifiableCredential];
  const revealGroups = Array.isArray(vp?.revealGroups) ? vp.revealGroups : undefined;

  return entries
    .map((entry: any, index: number) => normalizeCredentialEntry(entry, vp, revealGroups, index))
    .filter((entry): entry is NormalizedCredentialEntry => Boolean(entry?.token));
}

export function detectCredentialFormat(token: string): 'sd-jwt' | 'jwt-vc' {
  const parts = token.split('.');
  return parts.length === 4 ? 'sd-jwt' : 'jwt-vc';
}

function normalizeCredentialEntry(
  entry: any,
  vp: any,
  revealGroups: string[] | undefined,
  index: number,
): NormalizedCredentialEntry | null {
  if (typeof entry === 'string') {
    return {
      format: detectCredentialFormat(entry),
      token: entry,
      disclosures: pickDisclosures(vp, index),
      revealGroups,
    };
  }

  if (entry && typeof entry === 'object') {
    if (typeof entry.csdJwt === 'string') {
      return {
        format: 'sd-jwt',
        token: entry.csdJwt,
        disclosures: entry.disclosures ?? pickDisclosures(vp, index),
        revealGroups: entry.revealGroups ?? revealGroups,
      };
    }

    if (typeof entry.jwt === 'string') {
      return {
        format: detectCredentialFormat(entry.jwt),
        token: entry.jwt,
        disclosures: entry.disclosures ?? pickDisclosures(vp, index),
        revealGroups,
      };
    }
  }

  return null;
}

function pickDisclosures(vp: any, index: number): Array<Record<string, any>> | undefined {
  if (!vp?.disclosures) {
    return undefined;
  }

  if (Array.isArray(vp.disclosures) && Array.isArray(vp.disclosures[index])) {
    return vp.disclosures[index];
  }

  if (Array.isArray(vp.disclosures) && index === 0) {
    return vp.disclosures;
  }

  return undefined;
}


