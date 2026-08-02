/**
 * LicensureAuthorityRegistry — the national board inventory.
 *
 * PROVENANCE. The physician/osteopathic rows below were transcribed from the
 * FSMB "Contact a State Medical Board" directory, retrieved 2026-08-01 from
 * https://production.fsmb.org/contact-a-state-medical-board/. Board names and
 * official URLs are as published there. Rows are not authored from memory, and
 * new rows must cite a retrieval the same way.
 *
 * WHAT THIS FILE IS NOT. Every row here is a catalog entry. A row does not mean
 * VitalCV can read that board, is permitted to read it, or has ever read it.
 * Runtime facts live in `runtimeState.ts`, keyed by authorityId. Do not add a
 * status, health, or coverage field to this file.
 *
 * KNOWN INVENTORY GAPS (deliberate — do not fill these in from memory):
 *   - Physician-assistant licensure authority per jurisdiction is NOT
 *     inventoried. The FSMB directory does not publish PA scope per board, so
 *     `professions` below carries only what that directory evidences. See
 *     PA_SCOPE_NOT_INVENTORIED.
 *   - State boards of nursing are NOT inventoried. Nursing is routed
 *     nationally through Nursys/NCSBN; the ~59 individual BONs need their own
 *     sourced retrieval before they can appear here.
 *   - American Samoa has no FSMB member medical board and therefore no row.
 *     That is a finding about the jurisdiction, not an omission.
 *   - Public search URLs are not recorded. Identifying a lawful, machine-
 *     accessible search surface per board is per-board diligence (wave L5), and
 *     a URL recorded without that diligence reads as coverage we do not have.
 */

import type { AuthorityProvenance, LicensureAuthority, Jurisdiction, Profession, BoardType } from './types';

const FSMB_DIRECTORY: AuthorityProvenance = {
  source: 'FSMB_MEMBER_BOARD_DIRECTORY',
  sourceUrl: 'https://production.fsmb.org/contact-a-state-medical-board/',
  retrievedAt: '2026-08-01T00:00:00.000Z',
};

const NCSBN_PUBLISHED: AuthorityProvenance = {
  source: 'NCSBN_PUBLISHED',
  sourceUrl: 'https://ncsbn.org/nursing-regulation/licensure/license-verification.page',
  retrievedAt: '2026-08-01T00:00:00.000Z',
};

export const PA_SCOPE_NOT_INVENTORIED =
  'Physician-assistant licensure scope is not inventoried for this board. Absence of PHYSICIAN_ASSISTANT in professions means "not established", not "not licensed here".';

const CATALOG_LIMITATION =
  'Catalog entry only. This board exists; it is not a configured or operational source.';

const MD: readonly Profession[] = ['PHYSICIAN_MD'];
const DO: readonly Profession[] = ['PHYSICIAN_DO'];
const MD_DO: readonly Profession[] = ['PHYSICIAN_MD', 'PHYSICIAN_DO'];

/** [authorityId, jurisdiction, boardName, boardType, officialUrl, professions] */
type Row = readonly [string, Jurisdiction, string, BoardType, string, readonly Profession[]];

const ROWS: readonly Row[] = [
  ['AL_BME', 'AL', 'Alabama Board of Medical Examiners', 'COMBINED', 'https://www.albme.gov', MD_DO],
  ['AL_MLC', 'AL', 'Medical Licensure Commission of Alabama', 'LICENSURE_COMMISSION', 'https://www.albme.gov', MD_DO],
  ['AK_MED', 'AK', 'Alaska State Medical Board', 'COMBINED', 'https://www.commerce.alaska.gov/web/cbpl/ProfessionalLicensing/StateMedicalBoard.aspx', MD_DO],
  ['AZ_MED', 'AZ', 'Arizona Medical Board', 'ALLOPATHIC', 'https://www.azmd.gov/', MD],
  ['AZ_OSTEO', 'AZ', 'Arizona Board of Osteopathic Examiners in Medicine and Surgery', 'OSTEOPATHIC', 'https://www.azdo.gov/', DO],
  ['AR_MED', 'AR', 'Arkansas State Medical Board', 'COMBINED', 'https://www.armedicalboard.org/', MD_DO],
  ['CA_MED', 'CA', 'Medical Board of California', 'ALLOPATHIC', 'https://www.mbc.ca.gov/', MD],
  ['CA_OSTEO', 'CA', 'Osteopathic Medical Board of California', 'OSTEOPATHIC', 'https://www.ombc.ca.gov/', DO],
  ['CO_MED', 'CO', 'Colorado Medical Board', 'COMBINED', 'https://dpo.colorado.gov/Medical', MD_DO],
  ['CT_MED', 'CT', 'Connecticut Medical Examining Board', 'COMBINED', 'https://portal.ct.gov/DPH/Public-Health-Hearing-Office/Connecticut-Medical-Examining-Board/Connecticut-Medical-Examining-Board', MD_DO],
  ['DE_MED', 'DE', 'Delaware Board of Medical Licensure and Discipline', 'COMBINED', 'https://dpr.delaware.gov/boards/medicalpractice/', MD_DO],
  ['DC_MED', 'DC', 'District of Columbia Board of Medicine', 'COMBINED', 'https://dchealth.dc.gov/bomed', MD_DO],
  ['FL_MED', 'FL', 'Florida Board of Medicine', 'ALLOPATHIC', 'https://www.flboardofmedicine.gov/', MD],
  ['FL_OSTEO', 'FL', 'Florida Board of Osteopathic Medicine', 'OSTEOPATHIC', 'https://www.floridasosteopathicmedicine.gov', DO],
  ['GA_MED', 'GA', 'Georgia Composite Medical Board', 'COMBINED', 'https://medicalboard.georgia.gov/', MD_DO],
  ['GU_MED', 'GU', 'Guam Board of Medical Examiners', 'COMBINED', 'https://guamhplo.org/gbme', MD_DO],
  ['HI_MED', 'HI', 'Hawaii Medical Board', 'COMBINED', 'https://cca.hawaii.gov/pvl/boards/medical/', MD_DO],
  ['ID_MED', 'ID', 'Idaho Board of Medicine', 'COMBINED', 'https://dopl.idaho.gov/bom/', MD_DO],
  ['IL_MED', 'IL', 'Illinois State Medical Board', 'COMBINED', 'https://idfpr.illinois.gov/profs/physicians.html', MD_DO],
  ['IN_MED', 'IN', 'Medical Licensing Board of Indiana', 'COMBINED', 'https://www.in.gov/pla/professions/physicians-home', MD_DO],
  ['IA_MED', 'IA', 'Iowa Board of Medicine', 'COMBINED', 'https://www.medicalboard.iowa.gov', MD_DO],
  ['KS_MED', 'KS', 'Kansas State Board of Healing Arts', 'COMBINED', 'https://www.ksbha.ks.gov', MD_DO],
  ['KY_MED', 'KY', 'Kentucky Board of Medical Licensure', 'COMBINED', 'https://kbml.ky.gov', MD_DO],
  ['LA_MED', 'LA', 'Louisiana State Board of Medical Examiners', 'COMBINED', 'http://www.lsbme.la.gov/', MD_DO],
  ['ME_MED', 'ME', 'Maine Board of Licensure in Medicine', 'ALLOPATHIC', 'https://www.maine.gov/md', MD],
  ['ME_OSTEO', 'ME', 'Maine Board of Osteopathic Licensure', 'OSTEOPATHIC', 'https://www.maine.gov/osteo', DO],
  ['MD_MED', 'MD', 'Maryland Board of Physicians', 'COMBINED', 'https://www.mbp.state.md.us/', MD_DO],
  ['MA_MED', 'MA', 'Massachusetts Board of Registration in Medicine', 'COMBINED', 'https://www.mass.gov/orgs/board-of-registration-in-medicine', MD_DO],
  ['MI_MED', 'MI', 'Michigan Board of Medicine', 'ALLOPATHIC', 'https://www.michigan.gov/lara/bureau-list/bpl/health/hp-lic-health-prof/medical', MD],
  ['MI_OSTEO', 'MI', 'Michigan Board of Osteopathic Medicine and Surgery', 'OSTEOPATHIC', 'https://www.michigan.gov/lara/bureau-list/bpl/health/hp-lic-health-prof/osteo', DO],
  ['MN_MED', 'MN', 'Minnesota Board of Medical Practice', 'COMBINED', 'https://mn.gov/boards/medical-practice/', MD_DO],
  ['MS_MED', 'MS', 'Mississippi State Board of Medical Licensure', 'COMBINED', 'https://www.msbml.ms.gov', MD_DO],
  ['MO_MED', 'MO', 'Missouri Board of Registration for the Healing Arts', 'COMBINED', 'https://www.pr.mo.gov/healingarts.asp', MD_DO],
  ['MT_MED', 'MT', 'Montana Board of Medical Examiners', 'COMBINED', 'https://boards.bsd.dli.mt.gov/medical-examiners/', MD_DO],
  ['NE_MED', 'NE', 'Nebraska Board of Medicine and Surgery', 'COMBINED', 'https://dhhs.ne.gov/licensure/pages/medicine-and-surgery.aspx', MD_DO],
  ['NV_MED', 'NV', 'Nevada State Board of Medical Examiners', 'ALLOPATHIC', 'https://medboard.nv.gov/', MD],
  ['NV_OSTEO', 'NV', 'Nevada State Board of Osteopathic Medicine', 'OSTEOPATHIC', 'https://bom.nv.gov/', DO],
  ['NH_MED', 'NH', 'New Hampshire Board of Medicine', 'COMBINED', 'https://www.oplc.nh.gov/board-medicine', MD_DO],
  ['NJ_MED', 'NJ', 'New Jersey State Board of Medical Examiners', 'COMBINED', 'https://www.njconsumeraffairs.gov/bme/Pages/default.aspx', MD_DO],
  ['NM_MED', 'NM', 'New Mexico Medical Board', 'COMBINED', 'https://www.nmmb.state.nm.us', MD_DO],
  ['NY_MED', 'NY', 'New York State Board for Medicine (Licensure)', 'COMBINED', 'https://www.op.nysed.gov/professions-index/medicine', MD_DO],
  ['NY_OPMC', 'NY', 'New York State Office of Professional Medical Conduct (Discipline)', 'DISCIPLINE_ONLY', 'https://www.health.ny.gov/professionals/doctors/conduct/', MD_DO],
  ['MP_HCPLB', 'MP', 'Commonwealth of the Northern Mariana Islands Health Care Professions Licensing Board', 'COMBINED', 'https://www.cnmilicensing.gov.mp/', MD_DO],
  ['NC_MED', 'NC', 'North Carolina Medical Board', 'COMBINED', 'https://www.ncmedboard.org', MD_DO],
  ['ND_MED', 'ND', 'North Dakota Board of Medicine', 'COMBINED', 'https://www.ndbom.org', MD_DO],
  ['OH_MED', 'OH', 'State Medical Board of Ohio', 'COMBINED', 'https://www.med.ohio.gov', MD_DO],
  ['OK_MED', 'OK', 'Oklahoma Board of Medical Licensure and Supervision', 'ALLOPATHIC', 'https://www.okmedicalboard.org', MD],
  ['OK_OSTEO', 'OK', 'Oklahoma State Board of Osteopathic Examiners', 'OSTEOPATHIC', 'https://www.ok.gov/osboe/', DO],
  ['OR_MED', 'OR', 'Oregon Medical Board', 'COMBINED', 'https://www.oregon.gov/OMB', MD_DO],
  ['PA_MED', 'PA', 'Pennsylvania State Board of Medicine', 'ALLOPATHIC', 'http://www.dos.pa.gov/ProfessionalLicensing/BoardsCommissions/Medicine/Pages/default.aspx', MD],
  ['PA_OSTEO', 'PA', 'Pennsylvania State Board of Osteopathic Medicine', 'OSTEOPATHIC', 'https://www.dos.state.pa.us', DO],
  ['PR_MED', 'PR', 'Puerto Rico Board of Medical Licensure and Discipline', 'COMBINED', 'https://www.salud.pr.gov/CMS/120', MD_DO],
  ['RI_MED', 'RI', 'Rhode Island Board of Medical Licensure and Discipline', 'COMBINED', 'https://health.ri.gov/licensing/physicians', MD_DO],
  ['SC_MED', 'SC', 'South Carolina Board of Medical Examiners', 'COMBINED', 'https://llr.sc.gov/', MD_DO],
  ['SD_MED', 'SD', 'South Dakota Board of Medical and Osteopathic Examiners', 'COMBINED', 'https://www.sdbmoe.gov', MD_DO],
  ['TN_MED', 'TN', 'Tennessee Board of Medical Examiners', 'ALLOPATHIC', 'https://www.tn.gov/health/licensure/me.html', MD],
  ['TN_OSTEO', 'TN', 'Tennessee Board of Osteopathic Examination', 'OSTEOPATHIC', 'https://www.tn.gov/health/licensure/ost.html', DO],
  ['TX_MED', 'TX', 'Texas Medical Board', 'COMBINED', 'https://www.tmb.texas.gov', MD_DO],
  ['UT_MED', 'UT', 'Utah Medical Licensing Board', 'COMBINED', 'https://commerce.utah.gov/dopl/physician-and-surgeon/', MD_DO],
  ['VT_MED', 'VT', 'Vermont Board of Medical Practice', 'ALLOPATHIC', 'https://www.healthvermont.gov/systems/medical-practice-board', MD],
  ['VT_OSTEO', 'VT', 'Vermont Board of Osteopathic Physicians and Surgeons', 'OSTEOPATHIC', 'https://sos.vermont.gov/osteopathic-physicians/', DO],
  ['VI_MED', 'VI', 'Virgin Islands Board of Medical Examiners', 'COMBINED', 'https://www.vimedicalboard.org/', MD_DO],
  ['VA_MED', 'VA', 'Virginia Board of Medicine', 'COMBINED', 'http://www.dhp.virginia.gov/Boards/Medicine/', MD_DO],
  ['WA_MED', 'WA', 'Washington Medical Commission', 'ALLOPATHIC', 'https://www.wmc.wa.gov', MD],
  ['WA_OSTEO', 'WA', 'Washington Board of Osteopathic Medicine and Surgery', 'OSTEOPATHIC', 'https://www.doh.wa.gov', DO],
  ['WV_MED', 'WV', 'West Virginia Board of Medicine', 'ALLOPATHIC', 'https://www.wvbom.wv.gov', MD],
  ['WV_OSTEO', 'WV', 'West Virginia Board of Osteopathic Medicine', 'OSTEOPATHIC', 'https://www.wvbdosteo.org', DO],
  ['WI_MED', 'WI', 'Wisconsin Medical Examining Board', 'COMBINED', 'https://dsps.wi.gov/Pages/BoardsCouncils/MEB/Default.aspx', MD_DO],
  ['WY_MED', 'WY', 'Wyoming Board of Medicine', 'COMBINED', 'https://wyomedboard.wyo.gov/', MD_DO],
];

const PHYSICIAN_AUTHORITIES: readonly LicensureAuthority[] = ROWS.map(
  ([authorityId, jurisdiction, boardName, boardType, officialUrl, professions]) => ({
    authorityId,
    jurisdiction,
    boardName,
    boardType,
    professions,
    officialUrl,
    publicSearchUrl: null,
    provenance: FSMB_DIRECTORY,
    limitation: CATALOG_LIMITATION,
  }),
);

/**
 * Nursing is routed nationally through Nursys rather than through per-state
 * board rows, so the national network is represented as a single pseudo-
 * authority. This is NOT a claim that Nursys is reachable — see runtimeState.
 *
 * The individual boards of nursing remain uninventoried; a Nursys result must
 * still name the originating board it came from, which is why
 * LicensureObservation.originatingAuthorityId is required rather than defaulted
 * to this row.
 */
const NURSYS_NATIONAL: LicensureAuthority = {
  authorityId: 'NURSYS_NATIONAL',
  jurisdiction: 'DC',
  boardName: 'Nursys (NCSBN) — national nurse licensure network',
  boardType: 'NURSING',
  professions: ['RN', 'LPN_VN', 'APRN'],
  officialUrl: 'https://ncsbn.org/nursing-regulation/licensure/license-verification.page',
  publicSearchUrl: null,
  provenance: NCSBN_PUBLISHED,
  limitation:
    'National aggregation point for participating boards of nursing. Not every board participates, and a Nursys result must always name the originating board. Individual boards of nursing are not yet inventoried.',
};

const ALL: readonly LicensureAuthority[] = [...PHYSICIAN_AUTHORITIES, NURSYS_NATIONAL];

const BY_ID: ReadonlyMap<string, LicensureAuthority> = new Map(
  ALL.map((authority) => [authority.authorityId, authority]),
);

// ── Public API ──────────────────────────────────────────────────────

export function listAuthorities(): readonly LicensureAuthority[] {
  return ALL;
}

export function getAuthority(authorityId: string): LicensureAuthority | null {
  return BY_ID.get(authorityId) ?? null;
}

export function listAuthoritiesForJurisdiction(
  jurisdiction: Jurisdiction,
): readonly LicensureAuthority[] {
  return ALL.filter((authority) => authority.jurisdiction === jurisdiction);
}

/**
 * Boards that can license the given profession in the given jurisdiction.
 *
 * An empty result means "no inventoried authority", never "no such license".
 */
export function listAuthoritiesFor(
  jurisdiction: Jurisdiction,
  profession: Profession,
): readonly LicensureAuthority[] {
  return ALL.filter(
    (authority) =>
      authority.jurisdiction === jurisdiction &&
      authority.professions.includes(profession) &&
      authority.boardType !== 'DISCIPLINE_ONLY',
  );
}

/** Jurisdictions with at least one inventoried medical board. */
export function listInventoriedJurisdictions(): readonly Jurisdiction[] {
  return [...new Set(PHYSICIAN_AUTHORITIES.map((a) => a.jurisdiction))];
}

/**
 * Jurisdictions the program targets but has NOT inventoried. Surfacing this is
 * the point: a coverage report that silently omits American Samoa reads as
 * complete when it is not.
 */
export const UNINVENTORIED_TARGET_JURISDICTIONS: readonly {
  readonly code: string;
  readonly reason: string;
}[] = [
  {
    code: 'AS',
    reason:
      'American Samoa is not listed as an FSMB member medical board. Whether an applicable licensure authority exists has not been established.',
  },
];
