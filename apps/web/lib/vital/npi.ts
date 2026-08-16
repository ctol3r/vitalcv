// lib/vital/npi.ts
//
// Canonical NPI validation for the shared <NpiInput> and the onboarding flow.
// Builds on the existing length/digit `validateNpi` (lib/get-ready/npi-binding)
// by adding the CMS check-digit test, so the UI can distinguish a mistyped
// number from a wrong-length one BEFORE a network round-trip. Pure + isomorphic.
//
// NPI check digit: prefix the first 9 digits with the CMS issuer id "80840"
// and run the Luhn algorithm; the result must equal the 10th (check) digit.
// (Worked example from the CMS spec: 1234567893 → valid. NPPES-unassigned,
// result_count 0 as of 2026-08-16 — never cite a registrant's NPI as an
// example; only checksum-valid numbers can name real people.)

export type NpiValidity =
  | 'empty'
  | 'not_numeric'
  | 'incomplete' // fewer than 10 digits
  | 'too_long'
  | 'bad_checksum'
  | 'valid';

export interface NpiCheck {
  validity: NpiValidity;
  /** Digits entered so far (0–10, non-digits stripped). */
  digits: string;
  /** The normalized 10-digit NPI when `validity === 'valid'`, else null. */
  npi: string | null;
  /** Color-independent, human reason when not valid (null when valid/empty). */
  reason: string | null;
}

/** True if a complete 10-digit string passes the CMS 80840 + Luhn check digit. */
export function isValidNpiChecksum(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const base = `80840${npi.slice(0, 9)}`;
  let sum = 0;
  let double = true; // rightmost base digit is doubled first
  for (let i = base.length - 1; i >= 0; i -= 1) {
    let d = base.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === npi.charCodeAt(9) - 48;
}

/** Strip everything but digits; cap at 10 for display. */
export function npiDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

/**
 * Full validation used to gate the CTA and drive the error state. Distinguishes
 * empty / non-numeric input / incomplete / bad checksum / valid — the states the
 * shared NpiInput renders (Type-1 vs Type-2 needs NPPES, resolved server-side).
 */
export function checkNpi(raw: string): NpiCheck {
  const hadNonDigit = /[^\d\s-]/.test(raw);
  const digits = npiDigits(raw);
  if (digits.length === 0) {
    return { validity: 'empty', digits, npi: null, reason: null };
  }
  if (hadNonDigit) {
    return { validity: 'not_numeric', digits, npi: null, reason: 'An NPI contains digits only.' };
  }
  if (digits.length < 10) {
    return {
      validity: 'incomplete',
      digits,
      npi: null,
      reason: `An NPI is 10 digits — ${digits.length} so far.`,
    };
  }
  if (!isValidNpiChecksum(digits)) {
    return {
      validity: 'bad_checksum',
      digits,
      npi: null,
      reason: 'That is 10 digits but not a valid NPI — check for a typo.',
    };
  }
  return { validity: 'valid', digits, npi: digits, reason: null };
}
