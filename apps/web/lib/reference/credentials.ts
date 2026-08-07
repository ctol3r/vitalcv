/**
 * credentials.ts — decoding the NPPES free-text credential string.
 *
 * WHAT THIS IS NOT
 * ----------------
 * `basic.credential` in NPPES is a free-text field the provider types when
 * they apply for or update an NPI. CMS does not validate it against any
 * certifying board. A provider can write "MD" without holding an MD, and CMS
 * will store it verbatim.
 *
 * So everything here is *presentation of a self-reported string*, never
 * evidence. Expanding "PA-C" to "Physician Assistant-Certified" tells a
 * reader what the abbreviation conventionally means — it does not assert the
 * person holds that certification. Callers must render the result behind a
 * self-reported label; `CREDENTIAL_PROVENANCE_NOTE` is provided so that
 * wording stays consistent across surfaces.
 *
 * Design rules:
 *   1. Never guess. An unrecognised token passes through with expansion null.
 *   2. Never reorder or drop tokens — the raw string is always recoverable.
 *   3. Matching is punctuation- and case-insensitive ("M.D." === "md"), but
 *      the token is displayed exactly as the provider wrote it.
 */

/** Wording every surface must use when showing a decoded credential. */
export const CREDENTIAL_PROVENANCE_NOTE =
  'Credential text is self-reported by the provider to CMS and is not checked against a certifying board.';

/**
 * Conventional meanings of common healthcare credential abbreviations.
 *
 * Keys are normalized (uppercase, punctuation stripped). This list is
 * deliberately conservative: entries were included only where the
 * abbreviation has a single widely-accepted expansion in US healthcare.
 * Ambiguous abbreviations are intentionally ABSENT so they render raw
 * rather than being resolved to a coin-flip.
 */
const CREDENTIAL_EXPANSIONS: Readonly<Record<string, string>> = Object.freeze({
  // ── Physicians ────────────────────────────────────────────────────────
  MD: 'Doctor of Medicine',
  DO: 'Doctor of Osteopathic Medicine',
  MBBS: 'Bachelor of Medicine, Bachelor of Surgery',

  // ── Physician assistants ──────────────────────────────────────────────
  PA: 'Physician Assistant',
  PAC: 'Physician Assistant-Certified',
  'PA-C': 'Physician Assistant-Certified',

  // ── Nursing ───────────────────────────────────────────────────────────
  RN: 'Registered Nurse',
  LPN: 'Licensed Practical Nurse',
  LVN: 'Licensed Vocational Nurse',
  APRN: 'Advanced Practice Registered Nurse',
  NP: 'Nurse Practitioner',
  FNP: 'Family Nurse Practitioner',
  FNPBC: 'Family Nurse Practitioner-Board Certified',
  FNPC: 'Family Nurse Practitioner-Certified',
  ANP: 'Adult Nurse Practitioner',
  PNP: 'Pediatric Nurse Practitioner',
  PMHNP: 'Psychiatric-Mental Health Nurse Practitioner',
  AGNP: 'Adult-Gerontology Nurse Practitioner',
  AGACNP: 'Adult-Gerontology Acute Care Nurse Practitioner',
  WHNP: "Women's Health Nurse Practitioner",
  NNP: 'Neonatal Nurse Practitioner',
  CNM: 'Certified Nurse-Midwife',
  CRNA: 'Certified Registered Nurse Anesthetist',
  CNS: 'Clinical Nurse Specialist',
  DNP: 'Doctor of Nursing Practice',
  MSN: 'Master of Science in Nursing',
  BSN: 'Bachelor of Science in Nursing',

  // ── Dental ────────────────────────────────────────────────────────────
  DDS: 'Doctor of Dental Surgery',
  DMD: 'Doctor of Dental Medicine',
  RDH: 'Registered Dental Hygienist',

  // ── Pharmacy ──────────────────────────────────────────────────────────
  PHARMD: 'Doctor of Pharmacy',
  RPH: 'Registered Pharmacist',

  // ── Behavioral health ─────────────────────────────────────────────────
  PHD: 'Doctor of Philosophy',
  PSYD: 'Doctor of Psychology',
  EDD: 'Doctor of Education',
  LCSW: 'Licensed Clinical Social Worker',
  LICSW: 'Licensed Independent Clinical Social Worker',
  LMSW: 'Licensed Master Social Worker',
  MSW: 'Master of Social Work',
  LPC: 'Licensed Professional Counselor',
  LPCC: 'Licensed Professional Clinical Counselor',
  LMHC: 'Licensed Mental Health Counselor',
  LMFT: 'Licensed Marriage and Family Therapist',
  LCPC: 'Licensed Clinical Professional Counselor',
  BCBA: 'Board Certified Behavior Analyst',
  RBT: 'Registered Behavior Technician',

  // ── Rehabilitation therapies ──────────────────────────────────────────
  DPT: 'Doctor of Physical Therapy',
  PT: 'Physical Therapist',
  PTA: 'Physical Therapist Assistant',
  OT: 'Occupational Therapist',
  OTR: 'Occupational Therapist, Registered',
  COTA: 'Certified Occupational Therapy Assistant',
  SLP: 'Speech-Language Pathologist',
  CCCSLP: 'Certificate of Clinical Competence in Speech-Language Pathology',
  RRT: 'Registered Respiratory Therapist',
  CRT: 'Certified Respiratory Therapist',
  AT: 'Athletic Trainer',
  ATC: 'Certified Athletic Trainer',

  // ── Other clinical doctorates and licences ────────────────────────────
  DC: 'Doctor of Chiropractic',
  DPM: 'Doctor of Podiatric Medicine',
  OD: 'Doctor of Optometry',
  DVM: 'Doctor of Veterinary Medicine',
  ND: 'Doctor of Naturopathic Medicine',
  LAC: 'Licensed Acupuncturist',
  RD: 'Registered Dietitian',
  RDN: 'Registered Dietitian Nutritionist',
  LDN: 'Licensed Dietitian Nutritionist',

  // ── Public health and administration ──────────────────────────────────
  MPH: 'Master of Public Health',
  MHA: 'Master of Health Administration',
  MBA: 'Master of Business Administration',
  MS: 'Master of Science',
  MA: 'Master of Arts',
});

/** One token parsed out of the raw credential string. */
export interface CredentialToken {
  /** Exactly as the provider wrote it, e.g. "M.D." */
  raw: string;
  /**
   * Conventional meaning, or null when the abbreviation is not one we
   * recognise. Null means "we don't know" — never render a guess.
   */
  expansion: string | null;
}

export interface DecodedCredential {
  /** The unmodified NPPES string. */
  raw: string;
  tokens: CredentialToken[];
  /** True when at least one token resolved. */
  anyRecognized: boolean;
}

/** Uppercase and strip punctuation/whitespace for dictionary matching. */
function normalizeToken(token: string): string {
  return token.replace(/[^A-Za-z]/g, '').toUpperCase();
}

/**
 * Decode an NPPES credential string into its component tokens.
 *
 * Providers write these inconsistently: "PA-C", "M.D.", "DO, FACC",
 * "MSN/FNP-BC". Split on commas, slashes and semicolons — but NOT on
 * hyphens, since "PA-C" and "FNP-BC" are single credentials.
 */
export function decodeCredential(raw: string | null | undefined): DecodedCredential {
  const source = (raw ?? '').trim();
  if (!source) {
    return { raw: '', tokens: [], anyRecognized: false };
  }

  const tokens: CredentialToken[] = source
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      // Try the hyphen-preserving form first ("PA-C"), then the fully
      // stripped form ("PAC"), so both spellings resolve to one entry.
      const withHyphen = part.toUpperCase().replace(/[^A-Z-]/g, '');
      const stripped = normalizeToken(part);
      const expansion =
        CREDENTIAL_EXPANSIONS[withHyphen] ?? CREDENTIAL_EXPANSIONS[stripped] ?? null;
      return { raw: part, expansion };
    });

  return {
    raw: source,
    tokens,
    anyRecognized: tokens.some((t) => t.expansion !== null),
  };
}
