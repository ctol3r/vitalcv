// backend/src/lib/npi.ts

/**
 * NPI Validation Utility
 *
 * Validates NPI format and checksum using Luhn algorithm
 */

export function isValidNPI(npi: string): boolean {
  const NPI_REGEX = /^[12]\d{9}$/;

  if (!NPI_REGEX.test(npi)) return false;

  const base = "80840" + npi.slice(0, 9);

  let sum = 0;

  // Luhn on payload string; right-to-left
  for (let i = base.length - 1, pos = 0; i >= 0; i--, pos++) {
    let d = parseInt(base[i], 10);

    if (pos % 2 === 0) {
      d = d * 2;
      if (d > 9) d -= 9;
    }

    sum += d;
  }

  const calcCheck = (10 - (sum % 10)) % 10;
  return calcCheck === parseInt(npi[9], 10);
}

