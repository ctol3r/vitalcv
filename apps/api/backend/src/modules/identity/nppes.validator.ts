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
    address_1: raw.address_1 ?? '',
    address_2: raw.address_2 ?? '',
    city: raw.city ?? '',
    state: raw.state ?? '',
    postal_code: raw.postal_code ?? '',
    country_code: raw.country_code ?? 'US',
    telephone_number: raw.telephone_number ?? '',
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

    // Classification
    primary_taxonomy: primaryTaxonomy?.desc ?? null,
    primary_taxonomy_code: primaryTaxonomy?.code ?? null,
    taxonomies,

    // Location — TEXT fields, never truncated
    practice_address,
    addresses,

    // Identifiers
    identifiers: result.identifiers ?? [],

    // Audit
    enumeration_date: basic.enumeration_date ?? '',
    last_updated: basic.last_updated ?? '',
  };
}
