/**
 * NPI (National Provider Identifier) Validation Utilities
 *
 * Implements Luhn algorithm over "80840" + first 9 digits for NPI checksum validation
 */

/**
 * Validates an NPI using the Luhn algorithm
 * @param npi - 10-digit NPI string
 * @returns true if valid NPI checksum
 */
export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;

  const base = '80840' + npi.slice(0, 9);
  let sum = 0;

  for (let i = 0; i < base.length; i++) {
    let d = Number(base[base.length - 1 - i]);
    if (i % 2 === 0) {
      // double alternate digits from right
      d = d * 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }

  const check = (10 - (sum % 10)) % 10;
  return check === Number(npi[9]);
}

/**
 * Formats NPI for display (XXX-XXX-XXXX)
 * @param npi - 10-digit NPI string
 * @returns Formatted string or original if invalid
 */
export function formatNpi(npi: string): string {
  const cleaned = npi.replace(/\D/g, '');
  if (cleaned.length !== 10) return npi;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}
