/**
 * nppes.validator.ts — Wave A (Phase 1 Hardening): NPPES v2-safe normalization
 *
 * NPPES v2 changed field lengths silently in 2023-2025:
 *   - address_1, address_2: up to 200 chars
 *   - organization_name:    up to 300 chars
 *   - credential:           up to 50 chars
 *   - taxonomy.desc:        up to 100 chars
 *
 * Rules:
 *   1. Never truncate any field — store full values as TEXT.
 *   2. Preserve raw endpoint response verbatim before normalization.
 *   3. Validate required fields; throw structured errors on missing critical data.
 *   4. Log warnings (not errors) for non-critical missing fields.
 *   5. Smoke-test fields for unexpected lengths (warn, don't reject).
 */

import { HttpError } from '../../utils/httpError';
import type {
  RawNppesResponse,
  RawNppesResult,
  NormalizedProvider,
  NormalizedTaxonomy,
  NormalizedAddress,
  NppesSmokeSample,
  RawNppesAddress,
  RawNppesEndpoint,
  RawNppesOtherName,
  RawNppesBasic,
  NormalizedEndpoint,
  NormalizedOtherName,
  NormalizedAuthorizedOfficial,
} from './types';

// ── Field-length thresholds (NPPES v2 maximums) ────────────────────────────
// If we see values EXCEEDING these, it's anomalous — emit a warning.

const FIELD_LENGTH_THRESHOLDS: Record<string, number> = {
  address_1: 200,
  address_2: 200,
  organization_name: 300,
  credential: 50,
  taxonomy_desc: 100,
  license: 20,
  city: 40,
  first_name: 35,
  last_name: 35,
  middle_name: 35,
};

// ── Normalize address ──────────────────────────────────────────────────────

function normalizeAddress(raw: RawNppesAddress): NormalizedAddress {
  return {
    purpose: raw.address_purpose,
    address_type: raw.address_type ?? '',
    address_1: raw.address_1 ?? '',
    address_2: raw.address_2 ?? '',
    city: raw.city ?? '',
    state: raw.state ?? '',
    postal_code: raw.postal_code ?? '',
    country_code: raw.country_code ?? 'US',
    country_name: raw.country_name ?? '',
    telephone_number: raw.telephone_number ?? '',
    fax_number: raw.fax_number ?? '',
  };
}

/**
 * Build the Type-2 authorized official block.
 *
 * Returns null when none of the `authorized_official_*` fields carry a value,
 * which is the normal case for individual (NPI-1) records. We key off the
 * name fields rather than `enumeration_type` so a malformed Type-2 record
 * without an official still normalizes to null instead of an empty shell.
 */
function normalizeAuthorizedOfficial(
  basic: RawNppesBasic,
): NormalizedAuthorizedOfficial | null {
  const first_name = basic.authorized_official_first_name ?? '';
  const last_name = basic.authorized_official_last_name ?? '';
  const middle_name = basic.authorized_official_middle_name ?? '';
  const name_prefix = basic.authorized_official_name_prefix ?? '';
  const name_suffix = basic.authorized_official_name_suffix ?? '';
  const credential = basic.authorized_official_credential ?? '';
  const title_or_position = basic.authorized_official_title_or_position ?? '';
  const telephone_number = basic.authorized_official_telephone_number ?? '';

  if (!first_name && !last_name) return null;

  const display_name = [name_prefix, first_name, middle_name, last_name, name_suffix]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    display_name: credential ? `${display_name}, ${credential}` : display_name,
    first_name,
    last_name,
    middle_name,
    name_prefix,
    name_suffix,
    credential,
    title_or_position,
    telephone_number,
  };
}

function normalizeEndpoint(raw: RawNppesEndpoint): NormalizedEndpoint | null {
  const endpoint =
    typeof raw.endpoint === 'string' && raw.endpoint.trim().length > 0
      ? raw.endpoint.trim()
      : typeof raw.endpointUrl === 'string' && raw.endpointUrl.trim().length > 0
        ? raw.endpointUrl.trim()
        : '';
  if (!endpoint) {
    return null;
  }

  return {
    endpoint,
    endpointType:
      typeof raw.endpointType === 'string' && raw.endpointType.trim().length > 0
        ? raw.endpointType.trim()
        : '',
    endpointTypeDescription:
      typeof raw.endpointTypeDescription === 'string'
      && raw.endpointTypeDescription.trim().length > 0
        ? raw.endpointTypeDescription.trim()
        : '',
    affiliation:
      typeof raw.affiliation === 'string' && raw.affiliation.trim().length > 0
        ? raw.affiliation.trim()
        : '',
  };
}

function normalizeOtherName(raw: RawNppesOtherName): NormalizedOtherName | null {
  const displayName =
    typeof raw.organization_name === 'string' && raw.organization_name.trim().length > 0
      ? raw.organization_name.trim()
      : [raw.first_name, raw.last_name]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
          .join(' ');
  if (!displayName) {
    return null;
  }

  return {
    display_name: displayName,
    type:
      typeof raw.type === 'string' && raw.type.trim().length > 0
        ? raw.type.trim()
        : typeof raw.type_code === 'string' && raw.type_code.trim().length > 0
          ? raw.type_code.trim()
          : '',
  };
}

// ── Smoke test ─────────────────────────────────────────────────────────────

/**
 * Run a non-blocking smoke test on the first result of an NPPES response.
 * Returns warnings for anomalous field lengths; never throws.
 */
export function smokeTestNppesResult(result: RawNppesResult): NppesSmokeSample {
  const basic = result.basic ?? {};
  const warnings: string[] = [];
  const fields_present: string[] = [];
  const fields_missing: string[] = [];

  function checkField(value: string | undefined, name: string): string {
    const v = value ?? '';
    if (v.length > 0) {
      fields_present.push(name);
    } else {
      fields_missing.push(name);
    }
    const threshold = FIELD_LENGTH_THRESHOLDS[name];
    if (threshold && v.length > threshold) {
      warnings.push(
        `Field "${name}" length ${v.length} exceeds NPPES v2 maximum ${threshold} — check schema`,
      );
    }
    return v;
  }

  checkField(result.number, 'npi');
  checkField(basic.first_name, 'first_name');
  checkField(basic.last_name, 'last_name');
  checkField(basic.middle_name, 'middle_name');
  checkField(basic.credential, 'credential');
  checkField(basic.organization_name, 'organization_name');
  checkField(basic.status, 'status');
  checkField(basic.enumeration_date, 'enumeration_date');

  const primaryAddr = result.addresses?.find((a) => a.address_purpose === 'LOCATION');
  const addr1 = checkField(primaryAddr?.address_1, 'address_1');
  checkField(primaryAddr?.address_2, 'address_2');
  checkField(primaryAddr?.city, 'city');

  const primaryTax = result.taxonomies?.find((t) => t.primary);
  checkField(primaryTax?.desc, 'taxonomy_desc');
  checkField(primaryTax?.license, 'license');

  const passes =
    (result.number?.length === 10) &&
    (basic.status === 'A' || Boolean(basic.status)) &&
    warnings.length === 0;

  return {
    npi: result.number ?? '',
    fields_present,
    fields_missing,
    address_1_length: addr1.length,
    org_name_length: (basic.organization_name ?? '').length,
    credential_length: (basic.credential ?? '').length,
    taxonomy_count: result.taxonomies?.length ?? 0,
    passes,
    warnings,
  };
}

// ── Main normalizer ────────────────────────────────────────────────────────

/**
 * Normalize and validate a raw NPPES response into a complete NormalizedProvider.
 *
 * Throws HttpError on missing critical fields.
 * All string fields preserved at full length — no truncation.
 */
export function normalizeProvider(raw: RawNppesResponse): NormalizedProvider {
  const result = raw.results?.[0];
  if (!result) throw new HttpError(404, 'No results in NPPES response');

  const basic = result.basic;
  if (!basic) throw new HttpError(422, 'NPPES result missing basic information block');

  if (!basic.status) throw new HttpError(422, 'NPPES result missing provider status', 'INVALID_NPPES_DATA');

  const enumType = basic.enumeration_type || result.enumeration_type;
  if (!enumType) throw new HttpError(422, 'NPPES result missing enumeration_type', 'INVALID_NPPES_DATA');

  // ── Taxonomies ────────────────────────────────────────────────────────
  const taxonomies: NormalizedTaxonomy[] = (result.taxonomies ?? []).map((t) => ({
    code: t.code ?? '',
    taxonomy_group: t.taxonomy_group ?? '',
    desc: t.desc ?? '',            // TEXT — never truncate
    state: t.state ?? '',
    license: t.license ?? '',      // TEXT — never truncate
    primary: t.primary ?? false,
  }));

  const primaryTaxonomy = taxonomies.find((t) => t.primary) ?? taxonomies[0] ?? null;

  // ── Addresses ─────────────────────────────────────────────────────────
  const rawAddresses = (result.addresses ?? []) as RawNppesAddress[];
  const addresses: NormalizedAddress[] = rawAddresses.map(normalizeAddress);
  const practice_address =
    addresses.find((a) => a.purpose === 'LOCATION') ?? addresses[0] ?? null;
  const mailing_address =
    addresses.find((a) => a.purpose === 'MAILING') ?? null;
  // Secondary practice sites. CMS emits this key in camelCase and often omits
  // it entirely, so a missing key and an empty list are both normal.
  const practice_locations: NormalizedAddress[] = (
    (result.practiceLocations ?? []) as RawNppesAddress[]
  ).map(normalizeAddress);
  const endpoints: NormalizedEndpoint[] = ((result.endpoints ?? []) as RawNppesEndpoint[])
    .map(normalizeEndpoint)
    .filter((entry): entry is NormalizedEndpoint => entry !== null);
  const other_names: NormalizedOtherName[] = ((result.other_names ?? []) as RawNppesOtherName[])
    .map(normalizeOtherName)
    .filter((entry): entry is NormalizedOtherName => entry !== null);

  // ── Display name ──────────────────────────────────────────────────────
  let display_name = '';
  if (basic.organization_name) {
    display_name = basic.organization_name; // TEXT — never truncate
  } else {
    display_name = [basic.name_prefix, basic.first_name, basic.middle_name, basic.last_name, basic.name_suffix]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (basic.credential) display_name += `, ${basic.credential}`;
  }

  return {
    npi: result.number,
    enumeration_type: enumType,
    status: basic.status,

    // Name — all TEXT, never truncated
    first_name: basic.first_name ?? '',
    last_name: basic.last_name ?? '',
    middle_name: basic.middle_name ?? '',
    credential: basic.credential ?? '',    // up to 50 chars in v2
    name_prefix: basic.name_prefix ?? '',
    name_suffix: basic.name_suffix ?? '',
    organization_name: basic.organization_name ?? '', // up to 300 chars in v2
    display_name,

    // Demographics. NPPES v2.1 emits `sex`; v2.0 emitted `gender`. Read both
    // so a payload from either vintage populates the field rather than
    // silently rendering blank.
    sex: basic.sex ?? basic.gender ?? '',
    sole_proprietor: basic.sole_proprietor ?? '',

    // Classification
    primary_taxonomy: primaryTaxonomy?.desc ?? null,
    primary_taxonomy_code: primaryTaxonomy?.code ?? null,
    taxonomies,

    // Location — TEXT fields, never truncated
    practice_address,
    mailing_address,
    addresses,
    practice_locations,

    // Identifiers
    identifiers: result.identifiers ?? [],
    endpoints,
    other_names,

    // Organization (Type-2)
    organizational_subpart: basic.organizational_subpart ?? '',
    parent_organization_legal_business_name:
      basic.parent_organization_legal_business_name ?? '',
    authorized_official: normalizeAuthorizedOfficial(basic),

    // Audit
    enumeration_date: basic.enumeration_date ?? '',
    last_updated: basic.last_updated ?? '',
    certification_date: basic.certification_date ?? '',
    deactivation_date: basic.deactivation_date ?? '',
    deactivation_reason_code: basic.deactivation_reason_code ?? '',
    reactivation_date: basic.reactivation_date ?? '',
    created_epoch: result.created_epoch != null ? String(result.created_epoch) : '',
    last_updated_epoch:
      result.last_updated_epoch != null ? String(result.last_updated_epoch) : '',
  };
}
