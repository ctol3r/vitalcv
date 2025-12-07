/**
 * NPI (National Provider Identifier) Validation Utility
 * Validates NPI format and checksum using Luhn algorithm with NPI-specific prefix
 */

export function isValidNPI(npi: string): boolean {
  if (!/^[12]\d{9}$/.test(npi)) return false;
  // Luhn with '80840' prefix per NPI spec:
  const payload = "80840" + npi.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    let d = parseInt(payload[payload.length - 1 - i], 10);
    if (i % 2 === 0) {
      d = d * 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const calc = (10 - (sum % 10)) % 10;
  return calc === Number(npi[9]);
}
