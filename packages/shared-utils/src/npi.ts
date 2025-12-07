/**
 * NPI (National Provider Identifier) validation utilities
 */

/**
 * Validates an NPI using the Luhn algorithm
 * @param npi - 10-digit NPI string
 * @returns true if valid, false otherwise
 */
export function isValidNpi(npi: string): boolean {
  const cleaned = npi.replace(/\D/g, '');
  if (cleaned.length !== 10) return false;

  // Luhn algorithm over "80840" + first 9 digits
  const prefix = '80840';
  const digits = (prefix + cleaned.slice(0, 9)).split('').map(Number);

  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if ((digits.length - i) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned[9], 10);
}

/**
 * Formats an NPI for display (XXX-XXX-XXXX)
 * @param npi - NPI string
 * @returns Formatted NPI string
 */
export function formatNpi(npi: string): string {
  const cleaned = npi.replace(/\D/g, '');
  if (cleaned.length !== 10) return npi;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

