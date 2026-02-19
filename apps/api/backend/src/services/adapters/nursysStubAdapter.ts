import type { VerificationSource, VerificationResult } from '../../interfaces/verificationSource';

/**
 * Deterministic Nursys stub adapter for pilot use.
 *
 * Produces repeatable, NPI-derived responses with no randomness.
 * License status is derived from the first digit of the NPI:
 *   1-6 → ACTIVE
 *   7   → EXPIRED
 *   8   → SUSPENDED
 *   9   → REVOKED
 *   0   → INACTIVE
 *
 * Jurisdiction is derived from the last two digits.
 * Expiration date is seeded from the first six digits.
 */

const JURISDICTIONS = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'] as const;

function deriveStatus(npi: string): string {
  const firstDigit = parseInt(npi.charAt(0), 10);
  if (firstDigit >= 1 && firstDigit <= 6) return 'ACTIVE';
  if (firstDigit === 7) return 'EXPIRED';
  if (firstDigit === 8) return 'SUSPENDED';
  if (firstDigit === 9) return 'REVOKED';
  return 'INACTIVE';
}

function deriveJurisdiction(npi: string): string {
  const index = parseInt(npi.slice(-2), 10) % JURISDICTIONS.length;
  return JURISDICTIONS[index];
}

function deriveExpirationDate(npi: string): Date {
  const seedMs = parseInt(npi.slice(0, 6), 10) * 86_400_000;
  const baseDate = new Date(Date.now() - (seedMs % (365 * 86_400_000)));
  return new Date(baseDate.getTime() + 2 * 365 * 86_400_000);
}

export class NursysStubAdapter implements VerificationSource {
  readonly name = 'NURSYS_STUB';

  async verify(npi: string): Promise<VerificationResult> {
    const status = deriveStatus(npi);
    const jurisdiction = deriveJurisdiction(npi);
    const expirationDate = deriveExpirationDate(npi);
    const now = new Date();

    return {
      licenseStatus: status,
      jurisdiction,
      lastUpdated: now,
      expirationDate,
      sourceUrl: `https://www.nursys.com/LLV/LLVVerification.aspx?npi=${npi}`,
      rawPayload: {
        npi,
        licenseStatus: status,
        jurisdiction,
        lastUpdated: now.toISOString(),
        expirationDate: expirationDate.toISOString(),
        sourceQueriedAt: now.toISOString(),
        adapterName: 'NURSYS_STUB',
        deterministic: true,
      },
    };
  }
}
