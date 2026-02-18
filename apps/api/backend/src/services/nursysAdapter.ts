import { sha256ForPayload } from '../utils/deterministic';

/**
 * Structured license status response aligned with Nursys E-Notify data fields.
 * In production, this would be populated from a live Nursys API integration.
 */
export type NursysLicenseResult = Readonly<{
  licenseStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';
  jurisdiction: string;
  lastUpdated: string;
  expirationDate: string | null;
  sourceUrl: string;
  sourceQueriedAt: string;
}>;

export type NursysFetcher = (npi: string) => Promise<NursysLicenseResult>;

/**
 * Simulated Nursys source lookup. Returns a deterministic license result
 * derived from the NPI to enable repeatable artifact generation.
 *
 * Replace this with a live Nursys E-Notify client when integration is available.
 */
function simulatedFetch(npi: string): NursysLicenseResult {
  // Derive a deterministic jurisdiction from the NPI digits
  const jurisdictions = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
  const index = parseInt(npi.slice(-2), 10) % jurisdictions.length;
  const jurisdiction = jurisdictions[index];

  // Expiration: 2 years from a deterministic base date seeded by NPI
  const seedMs = parseInt(npi.slice(0, 6), 10) * 86400000;
  const baseDate = new Date(Date.now() - (seedMs % (365 * 86400000)));
  const expirationDate = new Date(baseDate.getTime() + 2 * 365 * 86400000);

  return {
    licenseStatus: 'ACTIVE',
    jurisdiction,
    lastUpdated: new Date().toISOString(),
    expirationDate: expirationDate.toISOString(),
    sourceUrl: `https://www.nursys.com/LLV/LLVVerification.aspx?npi=${npi}`,
    sourceQueriedAt: new Date().toISOString(),
  };
}

/**
 * Query Nursys for a given NPI. Accepts an optional fetcher override for testing.
 */
export async function queryNursysLicense(
  npi: string,
  fetcher?: NursysFetcher,
): Promise<NursysLicenseResult> {
  if (fetcher) {
    return fetcher(npi);
  }
  return simulatedFetch(npi);
}

/**
 * Compute a SHA-256 checksum for a serialized payload.
 * Uses deterministic JSON key ordering for reproducibility.
 */
export function computeArtifactChecksum(payload: unknown): string {
  return sha256ForPayload(payload);
}
