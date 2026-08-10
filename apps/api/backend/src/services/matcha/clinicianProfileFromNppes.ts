/**
 * NPPES → ClinicianProfile: a PURE transform (no prisma, no DB, no writes).
 *
 * Extracted from liveMatchaService so the honesty rules below can be unit-tested
 * without a database. That file carries `// @ts-nocheck` and constructs a
 * PrismaClient at module scope, which makes it unloadable under ts-jest — which
 * is precisely why this logic had no test when it started fabricating credentials.
 *
 * ── The fabrication this module exists to prevent ────────────────────────────
 *
 * The credential set used to be built UNCONDITIONALLY, outside the NPPES
 * try/catch, over a `let state = 'CA'` default. Every NPI handed to the public
 * feed came back holding an active NPI at L3, an active state licence at L2 from
 * "<state> Medical Board", and `sanctions_clear` at L2 — an exclusion screen that
 * never ran. Observed live on `GET /api/matcha/opportunities/:npi`, 2026-08-10,
 * all four returning the public fit reason "CA license on file, not source-checked":
 *
 *   1234567893  an invented number          (NPPES result_count = 0)
 *   1346053246  a real PA-C, NO licence in NPPES
 *   1225082860  Department of Veterans Affairs  (NPI-2, Military Hospital)
 *   1942355292  Palo Alto Medical Foundation    (NPI-2, clinic pharmacy)
 *
 * We told a pharmacy it held a California medical licence.
 *
 * ── The rules ────────────────────────────────────────────────────────────────
 *
 *  1. No NPPES resolution ⇒ NO PROFILE (`null`). A number that does not resolve,
 *     an unreachable registry, or an ORGANISATION (NPI-2) each yield null. "We do
 *     not know who this is" is a finding, not a blank to fill with defaults.
 *  2. `state_license` reaches L2 only on a SELF-REPORTED NPPES licence number.
 *     That number is a real claim carrying no status — exactly what L2 means.
 *     Provider-record existence is not a licence.
 *  3. `sanctions_clear` is NEVER derived from NPPES. NPPES says nothing about
 *     exclusion; only an OIG/LEIE answer may set it, and none is wired here.
 *     "Not excluded" is the most damaging thing to assert without having asked.
 *  4. No default jurisdiction. An empty `states` list is the honest reading.
 */
import type { ClinicianProfile, HeldCredential, SpecialtySource } from './matchaModels';

// ── NPPES taxonomy → specialty string ─────────────────────────────────────────

export const TAXONOMY_MAP: Record<string, string> = {
  '207Q00000X': 'Family Medicine',
  '207R00000X': 'Internal Medicine',
  '207P00000X': 'Emergency Medicine',
  '208000000X': 'Pediatrics',
  '207V00000X': 'Obstetrics & Gynecology',
  '208600000X': 'Surgery',
  '2084N0400X': 'Neurology',
  '208M00000X': 'Hospitalist',
  '207T00000X': 'Neurological Surgery',
  '208D00000X': 'General Practice',
  '163W00000X': 'Registered Nurse',
  '363L00000X': 'Nurse Practitioner',
  '363A00000X': 'Physician Assistant',
  '367500000X': 'Nurse Anesthesiologist (CRNA)',
  '261QP0905X': 'Community Health',
};

export function mapTaxonomy(code: string): string {
  return TAXONOMY_MAP[code] ?? 'Medicine';
}

/**
 * Broad specialty family from the description NPPES returns on the record.
 *
 * `TAXONOMY_MAP` covers 15 of the ~870 NUCC codes, so it fell through to the
 * generic 'Medicine' for most real providers — a board-certified dermatologist
 * (`207N00000X`) read as "Medicine" and could match no specialty at all. That
 * fallback was honest (it left `specialtySource: 'unknown'`, so nothing claimed a
 * checked specialty) but lossy, and no hand-maintained table will ever cover the
 * full set.
 *
 * NPPES already returns the taxonomy's own `desc` on the record, so use it.
 * Subspecialties are named "<family>, <subspecialty>" — "Internal Medicine,
 * Gastroenterology", "Psychiatry & Neurology, Addiction Medicine" — so the segment
 * before the first comma is the family, which is the granularity opportunity
 * listings are written at. This is exactly as source-backed as the code itself:
 * same record, same field, same request.
 */
export function specialtyFamilyFromDesc(desc: string | undefined | null): string | null {
  const family = (desc ?? '').split(',')[0].trim();
  return family.length > 0 ? family : null;
}

/**
 * Name the authority that licenses this taxonomy, by its NUCC code prefix.
 *
 * Getting this wrong is not cosmetic: a physician assistant is licensed by a
 * state PA board, an NP/RN by a board of nursing, a pharmacist by a board of
 * pharmacy. Labelling any of them "<state> Medical Board" — as this code did for
 * every provider — attributes their licence to a body that never issued it. When
 * the prefix is one we cannot place, say so generically rather than guess.
 */
export function licenseAuthorityFor(taxonomyCode: string): string {
  const code = (taxonomyCode || '').toUpperCase();
  if (code.startsWith('363A')) return 'State physician assistant board';
  if (code.startsWith('363L') || code.startsWith('163W') || code.startsWith('3675')) {
    return 'State board of nursing';
  }
  if (code.startsWith('1835')) return 'State board of pharmacy';
  // 207x / 208x = allopathic & osteopathic physicians.
  if (code.startsWith('207') || code.startsWith('208')) return 'State medical board';
  return 'State licensing authority';
}

/** Injectable so tests drive the real mapping without a network. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const NPPES_TIMEOUT_MS = 6000;

const defaultFetch: FetchLike = (url) =>
  fetch(url, { signal: AbortSignal.timeout(NPPES_TIMEOUT_MS) });

/**
 * Build the base profile from NPPES alone.
 *
 * Returns `null` when NPPES does not resolve this NPI to an INDIVIDUAL provider.
 * Callers must treat null as "unidentified" and refuse to match, score, or
 * simulate — every one of those would have to invent the credentials it uses.
 */
export async function buildBaseClinicianProfile(
  npi: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<ClinicianProfile | null> {
  const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
  let name = `Provider ${npi}`;
  let specialty = 'Medicine';
  // Only an NPPES taxonomy we actually resolve counts as a source check; the
  // generic 'Medicine' default stays 'unknown' so the engine never presents an
  // unverified specialty as checked.
  let specialtySource: SpecialtySource = 'unknown';
  let state: string | null = null;
  let resolved = false;
  let primaryCode = '';
  let selfReportedLicense: { number: string; state: string; authority: string } | null = null;

  try {
    const res = await fetchImpl(url);
    if (res.ok) {
      const data = (await res.json()) as any;
      const result = data?.results?.[0];
      // NPI-2 is an organisation. An organisation is not a clinician, and building
      // a "clinician profile" from one invents a person who does not exist.
      if (result && result.enumeration_type !== 'NPI-2') {
        resolved = true;
        const basic = result.basic ?? {};
        const givenName = basic.first_name || basic.authorized_official_first_name || '';
        const lastName = basic.last_name || basic.authorized_official_last_name || '';
        name = [givenName, lastName].filter(Boolean).join(' ') || name;

        const taxonomies: any[] = result.taxonomies ?? [];
        const primary = taxonomies.find((t: any) => t.primary) ?? taxonomies[0];
        if (primary?.code) {
          primaryCode = String(primary.code);
          // Curated broad bucket first (it normalises a few codes to the wording
          // listings use), then NPPES's own description for everything else.
          // Both come from this record, so either is a genuine NPPES source check
          // for specialty; only the generic 'Medicine' backstop stays 'unknown'.
          const curated = TAXONOMY_MAP[primaryCode];
          const fromDesc = specialtyFamilyFromDesc(primary.desc);
          if (curated) {
            specialty = curated;
            specialtySource = 'nppes_taxonomy';
          } else if (fromDesc) {
            specialty = fromDesc;
            specialtySource = 'nppes_taxonomy';
          } else {
            specialty = 'Medicine';
          }
        }
        if (primary?.state) state = primary.state;

        // A taxonomy licence number is SELF-REPORTED to NPPES: a real claim by the
        // provider, carrying no status and no verification. That is precisely L2.
        const licensed = taxonomies.find((t: any) => t.license && t.state);
        if (licensed) {
          selfReportedLicense = {
            number: String(licensed.license),
            state: String(licensed.state),
            authority: licenseAuthorityFor(String(licensed.code ?? primaryCode)),
          };
        }

        // Address-based state fallback.
        const addresses: any[] = result.addresses ?? [];
        const practice =
          addresses.find((a: any) => a.address_purpose === 'LOCATION') ?? addresses[0];
        if (practice?.state) state = practice.state;
      }
    }
  } catch {
    // NPPES unreachable — `resolved` stays false and we return null below rather
    // than inventing a provider. A failed lookup is not a blank profile.
  }

  if (!resolved) return null;

  const credentials: HeldCredential[] = [
    { key: 'npi', status: 'active', claimLevel: 'L3', issuer: 'CMS NPPES' },
    selfReportedLicense
      ? {
          key: 'state_license',
          status: 'active',
          claimLevel: 'L2', // a genuine self-report to NPPES: a number, no status
          issuer: selfReportedLicense.authority,
          state: selfReportedLicense.state,
        }
      : {
          key: 'state_license',
          status: 'pending',
          claimLevel: 'L1', // NPPES carries no licence for this provider
          issuer: 'State licensing authority',
          ...(state ? { state } : {}),
        },
    {
      // NPPES says nothing about exclusion. Until an OIG/LEIE answer is wired in,
      // this stays pending — never "clear".
      key: 'sanctions_clear',
      status: 'pending',
      claimLevel: 'L1',
      issuer: 'OIG LEIE',
    },
    { key: 'dea', status: 'pending', claimLevel: 'L1', issuer: 'DEA' },
    {
      key: 'board_cert',
      status: 'pending',
      claimLevel: 'L1',
      issuer: 'Board Certification',
      specialty,
    },
  ] as HeldCredential[];

  // No jurisdiction default. An empty states list means "NPPES gave us no state",
  // which the engine reads as not-practising-there — the honest reading — rather
  // than silently placing every unknown provider in California.
  return {
    npi,
    name,
    specialty,
    specialtySource,
    states: state ? [state] : [],
    credentials,
  } as ClinicianProfile;
}
