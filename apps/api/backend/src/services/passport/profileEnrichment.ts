/**
 * profileEnrichment — shared, provenance-honest readers for the two passport
 * builders (lean `npiPassportContract` + rich `passportService`).
 *
 * Two clusters of profile data hang off an NPI with very different provenance,
 * and this module keeps them honestly separated:
 *
 *   - practiceLocation → source-backed from CMS NPPES (a primary source). Read
 *     from the current PRACTICE_LOCATION claim (sourceId NPPES_API). Provenance
 *     is VERIFIED. Returns null when there is no NPPES practice-location claim or
 *     it carries no usable address — NEVER fabricated, never null-filled.
 *
 *   - selfReported (education + affiliations) → USER_ENTERED only. Read from
 *     PersonProfile.selfAttested, which the clinician typed. NPPES/OIG/PECOS
 *     carry NEITHER education nor associations, so there is no primary source to
 *     verify these against. Returned ONLY when the clinician actually provided
 *     them; otherwise null. Never inferred, never labeled verified.
 *
 * Both readers fail closed to null on any error so an unclaimed NPI simply omits
 * the data rather than crashing a passport build.
 */
import prisma from '../../graphql/prisma_client';

/**
 * Practice location — source-backed from NPPES (never null-fabricated).
 * Mirrors PassportData.practiceLocation in
 * apps/web/lib/trust/passport-contract.ts.
 */
export interface PassportPracticeLocation {
  city?: string;
  state?: string; // 2-letter
  postalCode?: string;
  addressLine?: string; // street line, optional
  provenance: 'VERIFIED'; // NPPES primary source
  sourceId: 'NPPES';
  lastCheckedAt?: string;
}

/**
 * Self-reported profile — USER_ENTERED only; present only when the clinician
 * provided it. Mirrors PassportData.selfReported.
 */
export interface PassportSelfReported {
  education?: Array<{ institution: string; degree?: string; graduationYear?: number }>;
  affiliations?: Array<{ organization: string; role?: string }>;
}

/** Claim statuses that must never surface a value (revoked fails closed). */
const NON_CURRENT_CLAIM_STATUSES = ['REVOKED', 'DELETED', 'SUPERSEDED'];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function cleanYear(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return undefined;
  const y = Math.trunc(n);
  return y >= 1900 && y <= 2100 ? y : undefined;
}

/**
 * Read the current NPPES PRACTICE_LOCATION claim for an NPI and project it onto
 * the source-backed practiceLocation contract. Returns null when there is no
 * NPPES practice-location claim or it carries no usable address field — this is
 * a source-verified headline, so an empty/absent claim omits the block rather
 * than fabricating a VERIFIED location.
 */
export async function loadPracticeLocationByNpi(
  npi: string | null | undefined,
): Promise<PassportPracticeLocation | null> {
  if (!npi) return null;

  const claim = await Promise.resolve()
    .then(() =>
      prisma.claimRecord.findFirst({
        where: {
          subjectNpi: npi,
          claimType: 'PRACTICE_LOCATION',
          sourceId: 'NPPES_API',
          status: { notIn: NON_CURRENT_CLAIM_STATUSES },
        },
        orderBy: { observedAt: 'desc' },
        select: { value: true, observedAt: true },
      }),
    )
    .catch(() => null);

  if (!claim) return null;

  const value = asRecord(claim.value);
  const city = cleanString(value.city);
  const state = cleanString(value.state)?.toUpperCase();
  const postalCode =
    cleanString(value.zip) ?? cleanString(value.postalCode) ?? cleanString(value.postal_code);
  const addressLine =
    cleanString(value.address1) ?? cleanString(value.addressLine1) ?? cleanString(value.line1);

  // No usable address fields → omit rather than fabricate an empty VERIFIED block.
  if (!city && !state && !postalCode && !addressLine) {
    return null;
  }

  const location: PassportPracticeLocation = {
    provenance: 'VERIFIED',
    sourceId: 'NPPES',
  };
  if (city) location.city = city;
  if (state) location.state = state;
  if (postalCode) location.postalCode = postalCode;
  if (addressLine) location.addressLine = addressLine;
  const lastCheckedAt = claim.observedAt?.toISOString();
  if (lastCheckedAt) location.lastCheckedAt = lastCheckedAt;

  return location;
}

/**
 * Read the clinician's self-attested profile (PersonProfile.selfAttested) for an
 * NPI and project the education + affiliations sections onto the USER_ENTERED
 * selfReported contract. Returns null unless the clinician actually provided
 * education or affiliations — never fabricates, never infers, never verifies.
 */
export async function loadSelfReportedByNpi(
  npi: string | null | undefined,
): Promise<PassportSelfReported | null> {
  if (!npi) return null;

  const profile = await Promise.resolve()
    .then(() =>
      prisma.personProfile.findUnique({
        where: { npi },
        select: { selfAttested: true },
      }),
    )
    .catch(() => null);

  if (!profile?.selfAttested) return null;

  const sa = asRecord(profile.selfAttested);

  const education: Array<{ institution: string; degree?: string; graduationYear?: number }> = [];
  const school = asRecord(sa.medicalSchool);
  const institution = cleanString(school.institutionName);
  if (institution) {
    const entry: { institution: string; degree?: string; graduationYear?: number } = { institution };
    const degree = cleanString(school.degree);
    if (degree) entry.degree = degree;
    const graduationYear = cleanYear(school.graduationYear);
    if (graduationYear !== undefined) entry.graduationYear = graduationYear;
    education.push(entry);
  }

  const affiliations: Array<{ organization: string; role?: string }> = [];
  if (Array.isArray(sa.affiliations)) {
    for (const raw of sa.affiliations) {
      const row = asRecord(raw);
      const organization = cleanString(row.organization);
      if (!organization) continue;
      const entry: { organization: string; role?: string } = { organization };
      const role = cleanString(row.role);
      if (role) entry.role = role;
      affiliations.push(entry);
    }
  }

  // The clinician provided nothing in either section → omit selfReported entirely.
  if (education.length === 0 && affiliations.length === 0) {
    return null;
  }

  const selfReported: PassportSelfReported = {};
  if (education.length > 0) selfReported.education = education;
  if (affiliations.length > 0) selfReported.affiliations = affiliations;
  return selfReported;
}
