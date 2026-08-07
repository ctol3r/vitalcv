/**
 * cmsClinicians.ts — CMS Doctors & Clinicians (National Downloadable File).
 *
 * The second federal source on the record, and the first that is not NPPES.
 * It matters because it carries things NPPES structurally cannot:
 *
 *   - medical school and graduation year
 *   - group practice affiliation, and how large that group is
 *   - whether the clinician accepts Medicare assignment
 *   - PECOS enrollment identifiers (PAC ID, enrollment ID)
 *
 * WHAT INCLUSION DOES AND DOES NOT MEAN
 * -------------------------------------
 * This file lists clinicians enrolled in Medicare. Appearing in it is
 * therefore real evidence of Medicare enrollment — CMS derives it from its own
 * enrollment records, not from a provider questionnaire. That is a stronger
 * claim than anything NPPES supports.
 *
 * But it is bounded, and the bound is easy to get wrong in both directions:
 *
 *   - ABSENCE IS NOT A FINDING. A clinician missing from this file may simply
 *     not bill Medicare — pediatrics, cash practices, and much of behavioral
 *     health are legitimately absent. Rendering absence as a negative would
 *     invent a problem out of a business model.
 *
 *   - PRESENCE IS NOT A LICENCE CHECK. Enrollment is not licensure, and this
 *     file says nothing about exclusions or discipline.
 *
 * The source catalog marks DOCTORS_CLINICIANS decisionGrade:false — enrichment
 * only. That ruling is respected here: the descriptor carries it, and nothing
 * from this source may gate a readiness decision.
 */

import type { NppesReading } from './build';

const ENDPOINT =
  'https://data.cms.gov/provider-data/api/1/datastore/query/mj5m-pzi6/0';
const TIMEOUT_MS = 8_000;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** One row of the National Downloadable File, one per clinician-per-address. */
export interface CmsClinicianRow {
  npi: string;
  /** PECOS individual PAC ID */
  individualPacId: string;
  /** PECOS individual enrollment ID */
  individualEnrollmentId: string;
  lastName: string;
  firstName: string;
  credential: string;
  medicalSchool: string;
  graduationYear: string;
  primarySpecialty: string;
  secondarySpecialties: string[];
  /** Group practice this clinician bills under at this location. */
  facilityName: string;
  organizationPacId: string;
  /** Number of clinicians in that group, as CMS counts them. */
  organizationMemberCount: string;
  city: string;
  state: string;
  /** "Y" | "N" | "" — accepts Medicare assignment as an individual. */
  individualAcceptsAssignment: string;
  /** "Y" | "N" | "" — the group accepts assignment. */
  groupAcceptsAssignment: string;
  telehealth: string;
}

export interface CmsCliniciansResult {
  /**
   * 'enrolled'      — rows found; the clinician is in the Medicare file
   * 'not_listed'    — CMS answered, with zero rows. NOT a negative finding.
   * 'unavailable'   — CMS could not be reached or answered unusably.
   */
  state: 'enrolled' | 'not_listed' | 'unavailable';
  rows: CmsClinicianRow[];
  retrievedAt: string;
}

function mapRow(raw: Record<string, unknown>): CmsClinicianRow {
  const secondaries = [
    str(raw.sec_spec_1),
    str(raw.sec_spec_2),
    str(raw.sec_spec_3),
    str(raw.sec_spec_4),
  ].filter((s) => s.length > 0);

  return {
    npi: str(raw.npi),
    individualPacId: str(raw.ind_pac_id),
    individualEnrollmentId: str(raw.ind_enrl_id),
    lastName: str(raw.provider_last_name),
    firstName: str(raw.provider_first_name),
    credential: str(raw.cred),
    medicalSchool: str(raw.med_sch),
    graduationYear: str(raw.grd_yr),
    primarySpecialty: str(raw.pri_spec),
    secondarySpecialties: [...new Set(secondaries)],
    facilityName: str(raw.facility_name),
    organizationPacId: str(raw.org_pac_id),
    organizationMemberCount: str(raw.num_org_mem),
    city: str(raw.citytown),
    state: str(raw.state),
    individualAcceptsAssignment: str(raw.ind_assgn),
    groupAcceptsAssignment: str(raw.grp_assgn),
    telehealth: str(raw.telehlth),
  };
}

/**
 * Look up a clinician in the CMS Doctors & Clinicians file.
 *
 * Fail-closed on the claim: any error returns 'unavailable', never
 * 'not_listed'. Those mean opposite things to a reader — one says CMS has
 * nothing on this clinician, the other says we could not ask — and collapsing
 * a network failure into "not listed" would manufacture a finding.
 */
export async function fetchCmsClinicianRows(
  npi: string,
): Promise<CmsCliniciansResult> {
  const retrievedAt = new Date().toISOString();
  const unavailable: CmsCliniciansResult = {
    state: 'unavailable',
    rows: [],
    retrievedAt,
  };

  if (!/^\d{10}$/.test(npi)) return unavailable;

  const params = new URLSearchParams();
  params.set('conditions[0][property]', 'npi');
  params.set('conditions[0][value]', npi);
  params.set('conditions[0][operator]', '=');
  // A clinician appears once per practice address; 40 covers even large
  // multi-site groups without pulling an unbounded page.
  params.set('limit', '40');

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Monthly-refresh source; caching for an hour is well inside its window.
      next: { revalidate: 3_600 },
    });
    if (!res.ok) return unavailable;

    const payload = (await res.json()) as { results?: unknown };
    if (!Array.isArray(payload.results)) return unavailable;

    const rows = payload.results
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map(mapRow)
      // Guard against a filter that silently did not apply — returning another
      // clinician's enrollment under this NPI would be far worse than nothing.
      .filter((r) => r.npi === npi);

    return {
      state: rows.length > 0 ? 'enrolled' : 'not_listed',
      rows,
      retrievedAt,
    };
  } catch {
    return unavailable;
  }
}

/**
 * Distinct group practices this clinician bills under.
 *
 * The file repeats a clinician once per address, so the raw rows over-report
 * affiliations badly — a physician at one 681-member group across six sites
 * appears six times.
 */
export function distinctAffiliations(
  rows: readonly CmsClinicianRow[],
): Array<{ facilityName: string; organizationPacId: string; memberCount: string; locations: number }> {
  const byOrg = new Map<
    string,
    { facilityName: string; organizationPacId: string; memberCount: string; locations: number }
  >();

  for (const row of rows) {
    if (!row.facilityName) continue;
    const key = row.organizationPacId || row.facilityName;
    const existing = byOrg.get(key);
    if (existing) {
      existing.locations += 1;
    } else {
      byOrg.set(key, {
        facilityName: row.facilityName,
        organizationPacId: row.organizationPacId,
        memberCount: row.organizationMemberCount,
        locations: 1,
      });
    }
  }

  return [...byOrg.values()].sort((a, b) => b.locations - a.locations);
}

/**
 * Training as CMS recorded it at enrollment.
 *
 * CMS writes "OTHER" when the school is outside its coded list, which is not
 * the same as unknown — but it carries no information either, so it is
 * normalized away rather than rendered as if it named a school.
 */
export function trainingFromRows(rows: readonly CmsClinicianRow[]): {
  medicalSchool: string;
  graduationYear: string;
} {
  const withTraining = rows.find((r) => r.graduationYear || r.medicalSchool);
  const school = withTraining?.medicalSchool ?? '';
  return {
    medicalSchool: school.toUpperCase() === 'OTHER' ? '' : school,
    graduationYear: withTraining?.graduationYear ?? '',
  };
}

/** True when any row reports the clinician accepts Medicare assignment. */
export function acceptsMedicareAssignment(
  rows: readonly CmsClinicianRow[],
): boolean | null {
  const flags = rows
    .map((r) => r.individualAcceptsAssignment.toUpperCase())
    .filter((f) => f === 'Y' || f === 'N');
  if (flags.length === 0) return null;
  return flags.includes('Y');
}

/**
 * Do the two federal sources name the same person?
 *
 * Two independent CMS systems describing one NPI is the first genuine
 * cross-source check on the record. A surname disagreement is worth surfacing:
 * it usually means a stale enrollment record or a name change, occasionally
 * something worse.
 *
 * Surname only. First names differ legitimately between these files —
 * nicknames, initials, transliteration — so a first-name mismatch is noise and
 * flagging it would train readers to ignore the check.
 *
 * Returns null when either side has no surname to compare, which is the
 * honest answer and distinct from `false`.
 */
export function surnameAgreesWithNppes(
  rows: readonly CmsClinicianRow[],
  reading: Pick<NppesReading, 'last_name'>,
): boolean | null {
  const cmsLast = rows.find((r) => r.lastName)?.lastName.trim().toUpperCase() ?? '';
  const nppesLast = (reading.last_name ?? '').trim().toUpperCase();
  if (!cmsLast || !nppesLast) return null;
  return cmsLast === nppesLast;
}
