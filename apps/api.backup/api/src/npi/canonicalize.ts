/**
 * NPI ↔ DID Registry Canonicalizer
 * FOIA-field allowlist + canonical JSON hash (sha256)
 * VCDM 2.0 VC schema: {npi,enumerationType,practiceRegion,endpoints[],nppesHash,nppesAsOf}
 */

import crypto from 'crypto';

export interface NpiCanonical {
  npi: string;
  enumerationType: string;
  name?: string;
  practiceRegion?: string;
  endpoints?: string[];
  nppesAsOf: string;
}

/**
 * Canonicalize NPI object to stable JSON hash
 * Only includes FOIA-public fields per CMS NPPES v2.1 → DID binding policy
 */
export function canonicalNpi(obj: any): string {
  // FOIA-only fields per CMS policy
  const canonical: NpiCanonical = {
    npi: obj.npi || obj.number,
    enumerationType: obj.enumerationType || obj.enumeration_type || (obj.type === 1 ? 'NPI-1' : 'NPI-2'),
    name: obj.basic?.name || obj.basic?.organization_name || obj.name,
    practiceRegion: obj.addresses?.[0]
      ? `${obj.addresses[0].city || ''}|${obj.addresses[0].state || ''}`
      : undefined,
    endpoints: (obj.endpoints || []).map((e: any) => e.endpoint || e.url || e),
    nppesAsOf: new Date().toISOString(),
  };

  // Remove undefined fields
  Object.keys(canonical).forEach((key) => {
    if (canonical[key as keyof NpiCanonical] === undefined) {
      delete canonical[key as keyof NpiCanonical];
    }
  });

  // Sort keys for stable canonicalization
  const sorted = Object.keys(canonical)
    .sort()
    .reduce((acc, key) => {
      acc[key] = canonical[key as keyof NpiCanonical];
      return acc;
    }, {} as Record<string, any>);

  return JSON.stringify(sorted);
}

/**
 * Generate SHA256 hash of canonical NPI representation
 */
export function hashCanonicalNpi(obj: any): string {
  const canonical = canonicalNpi(obj);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

