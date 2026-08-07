/**
 * nppes.ts — server-side NPPES read for the clinician record.
 *
 * RELATIONSHIP TO THE BACKEND NORMALIZER
 * --------------------------------------
 * `apps/api/backend/src/modules/identity/nppes.validator.ts` is the origin of
 * NPPES normalization. This module exists because apps/web cannot import from
 * apps/api/backend, and the record surfaces render server-side in the web app.
 *
 * It is deliberately a THIN field mapper — it renames CMS keys into the
 * NppesReading shape and does nothing else. All interpretation (credential
 * decoding, taxonomy resolution, freshness, gap detection) lives in build.ts,
 * so the logic that could drift between the two apps is not duplicated here.
 * Consolidating both onto a shared package is tracked follow-up work.
 *
 * Fail-closed: any error returns null. A partially-populated record would
 * render as a real provider record with fields silently missing, which is
 * worse than showing nothing.
 */

import type { NppesReading } from './build';

const NPPES_ENDPOINT = 'https://npiregistry.cms.hhs.gov/api/';
const TIMEOUT_MS = 8_000;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapAddress(raw: Record<string, unknown>) {
  return {
    purpose: str(raw.address_purpose),
    address_type: str(raw.address_type),
    address_1: str(raw.address_1),
    address_2: str(raw.address_2),
    city: str(raw.city),
    state: str(raw.state),
    postal_code: str(raw.postal_code),
    country_code: str(raw.country_code) || 'US',
    country_name: str(raw.country_name),
    telephone_number: str(raw.telephone_number),
    fax_number: str(raw.fax_number),
  };
}

/**
 * Map a raw CMS result into NppesReading.
 *
 * Exported so it can be tested against captured payloads without a network
 * call, and so callers holding a raw payload from elsewhere can reuse it.
 */
export function mapNppesResult(result: Record<string, unknown>): NppesReading {
  const basic = (result.basic ?? {}) as Record<string, unknown>;

  const addresses = (Array.isArray(result.addresses) ? result.addresses : [])
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object')
    .map(mapAddress);

  const practiceLocations = (
    Array.isArray(result.practiceLocations) ? result.practiceLocations : []
  )
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object')
    .map(mapAddress);

  const taxonomies = (Array.isArray(result.taxonomies) ? result.taxonomies : [])
    .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
    .map((t) => ({
      code: str(t.code),
      taxonomy_group: str(t.taxonomy_group),
      desc: str(t.desc),
      state: str(t.state),
      license: str(t.license),
      primary: t.primary === true,
    }));

  const primary = taxonomies.find((t) => t.primary) ?? taxonomies[0] ?? null;

  const firstName = str(basic.first_name);
  const lastName = str(basic.last_name);
  const middleName = str(basic.middle_name);
  const prefix = str(basic.name_prefix);
  const suffix = str(basic.name_suffix);
  const credential = str(basic.credential);
  const orgName = str(basic.organization_name);

  let displayName = orgName;
  if (!displayName) {
    displayName = [prefix, firstName, middleName, lastName, suffix]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (credential) displayName += `, ${credential}`;
  }

  const authorizedFirst = str(basic.authorized_official_first_name);
  const authorizedLast = str(basic.authorized_official_last_name);
  const authorizedCredential = str(basic.authorized_official_credential);
  const authorizedDisplay = [
    str(basic.authorized_official_name_prefix),
    authorizedFirst,
    str(basic.authorized_official_middle_name),
    authorizedLast,
    str(basic.authorized_official_name_suffix),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    npi: str(result.number),
    enumeration_type: str(result.enumeration_type) || str(basic.enumeration_type),
    status: str(basic.status),

    first_name: firstName,
    last_name: lastName,
    middle_name: middleName,
    credential,
    name_prefix: prefix,
    name_suffix: suffix,
    organization_name: orgName,
    display_name: displayName,

    // NPPES v2.1 emits `sex`; v2.0 emitted `gender`. Read both.
    sex: str(basic.sex) || str(basic.gender),
    sole_proprietor: str(basic.sole_proprietor),

    primary_taxonomy: primary?.desc ?? null,
    primary_taxonomy_code: primary?.code ?? null,
    taxonomies,

    practice_address: addresses.find((a) => a.purpose === 'LOCATION') ?? addresses[0] ?? null,
    mailing_address: addresses.find((a) => a.purpose === 'MAILING') ?? null,
    addresses,
    practice_locations: practiceLocations,

    identifiers: (Array.isArray(result.identifiers) ? result.identifiers : [])
      .filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === 'object')
      .map((i) => ({
        code: str(i.code),
        desc: str(i.desc),
        issuer: str(i.issuer),
        identifier: str(i.identifier),
        state: str(i.state),
      })),

    endpoints: (Array.isArray(result.endpoints) ? result.endpoints : [])
      .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
      .map((e) => ({
        endpoint: str(e.endpoint) || str(e.endpointUrl),
        endpointType: str(e.endpointType),
        endpointTypeDescription: str(e.endpointTypeDescription),
        affiliation: str(e.affiliation),
      }))
      .filter((e) => e.endpoint.length > 0),

    other_names: (Array.isArray(result.other_names) ? result.other_names : [])
      .filter((n): n is Record<string, unknown> => Boolean(n) && typeof n === 'object')
      .map((n) => ({
        display_name:
          str(n.organization_name) ||
          [str(n.first_name), str(n.last_name)].filter(Boolean).join(' '),
        type: str(n.type) || str(n.type_code),
      }))
      .filter((n) => n.display_name.length > 0),

    organizational_subpart: str(basic.organizational_subpart),
    parent_organization_legal_business_name: str(
      basic.parent_organization_legal_business_name,
    ),
    authorized_official:
      authorizedFirst || authorizedLast
        ? {
            display_name: authorizedCredential
              ? `${authorizedDisplay}, ${authorizedCredential}`
              : authorizedDisplay,
            title_or_position: str(basic.authorized_official_title_or_position),
            telephone_number: str(basic.authorized_official_telephone_number),
            credential: authorizedCredential,
          }
        : null,

    enumeration_date: str(basic.enumeration_date),
    last_updated: str(basic.last_updated),
    certification_date: str(basic.certification_date),
    deactivation_date: str(basic.deactivation_date),
    deactivation_reason_code: str(basic.deactivation_reason_code),
    reactivation_date: str(basic.reactivation_date),
    created_epoch: result.created_epoch != null ? String(result.created_epoch) : '',
    last_updated_epoch:
      result.last_updated_epoch != null ? String(result.last_updated_epoch) : '',
  };
}

export interface NppesFetchResult {
  reading: NppesReading;
  /** ISO timestamp of the read, for the record's provenance. */
  retrievedAt: string;
}

/**
 * Read one NPI from CMS.
 *
 * Returns null when the NPI is unknown, CMS is unreachable, or the response
 * is malformed. CMS answers "not found" with HTTP 200 and result_count 0,
 * so a 200 alone is not evidence the provider exists.
 */
export async function fetchNppesRecord(npi: string): Promise<NppesFetchResult | null> {
  if (!/^\d{10}$/.test(npi)) return null;

  try {
    const response = await fetch(
      `${NPPES_ENDPOINT}?version=2.1&number=${encodeURIComponent(npi)}&limit=1`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Cache for the NPPES refresh window rather than per-request. CMS
        // updates weekly; hammering it per page view buys nothing.
        next: { revalidate: 3_600 },
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as Record<string, unknown>;
    const results = Array.isArray(payload.results) ? payload.results : [];
    const first = results[0];
    if (!first || typeof first !== 'object') return null;

    return {
      reading: mapNppesResult(first as Record<string, unknown>),
      retrievedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
