/**
 * nppes.validator.test.ts — Wave A (Phase 1 Hardening)
 *
 * Smoke tests for NPPES v2 ingestion correctness.
 * Tests: field preservation, length guards, smoke-test pass/fail,
 * required-field validation, address normalization.
 */

import { normalizeProvider, smokeTestNppesResult } from '../src/modules/identity/nppes.validator';
import type { RawNppesResponse, RawNppesResult } from '../src/modules/identity/types';

// ── Fixtures ──────────────────────────────────────────────────────────────

const LONG_ADDRESS = 'A'.repeat(180);
const LONG_ORG_NAME = 'B'.repeat(280);
const LONG_CREDENTIAL = 'C'.repeat(45);

function makeRawResult(overrides: Partial<RawNppesResult['basic']> = {}, addressOverrides: object = {}): RawNppesResult {
  return {
    created_epoch: 1706745600,
    enumeration_type: 'NPI-1',
    last_updated_epoch: 1706745600,
    number: '1234567890',
    basic: {
      first_name: 'Jane',
      last_name: 'Smith',
      middle_name: 'A',
      credential: 'MD',
      sole_proprietor: 'N',
      gender: 'F',
      enumeration_date: '2010-05-15',
      last_updated: '2024-01-01',
      status: 'A',
      name_prefix: 'Dr.',
      name_suffix: '',
      enumeration_type: 'NPI-1',
      organization_name: '',
      ...overrides,
    },
    taxonomies: [
      { code: '207R00000X', taxonomy_group: '', desc: 'Internal Medicine', state: 'CA', license: 'A123456', primary: true },
    ],
    addresses: [
      {
        country_code: 'US',
        country_name: 'United States',
        address_purpose: 'LOCATION',
        address_type: 'DOM',
        address_1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94102',
        ...addressOverrides,
      },
    ],
    identifiers: [],
    endpoints: [],
    other_names: [],
  };
}

function makeRawResponse(overrides: Partial<RawNppesResult['basic']> = {}, addressOverrides: object = {}): RawNppesResponse {
  return { result_count: 1, results: [makeRawResult(overrides, addressOverrides)] };
}

// ── normalizeProvider ─────────────────────────────────────────────────────

describe('normalizeProvider', () => {
  it('returns all expected fields for a valid individual NPI', () => {
    const result = normalizeProvider(makeRawResponse());
    expect(result.npi).toBe('1234567890');
    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Smith');
    expect(result.credential).toBe('MD');
    expect(result.status).toBe('A');
    expect(result.enumeration_type).toBe('NPI-1');
    expect(result.primary_taxonomy).toBe('Internal Medicine');
    expect(result.primary_taxonomy_code).toBe('207R00000X');
    expect(result.taxonomies).toHaveLength(1);
    expect(result.taxonomies[0].license).toBe('A123456');
  });

  it('NEVER truncates long NPPES v2 address_1 fields (up to 200 chars)', () => {
    const result = normalizeProvider(makeRawResponse({}, { address_1: LONG_ADDRESS }));
    expect(result.practice_address?.address_1).toBe(LONG_ADDRESS);
    expect(result.practice_address?.address_1.length).toBe(180);
  });

  it('NEVER truncates long NPPES v2 organization_name fields (up to 300 chars)', () => {
    const result = normalizeProvider(makeRawResponse({ organization_name: LONG_ORG_NAME }));
    expect(result.organization_name).toBe(LONG_ORG_NAME);
    expect(result.organization_name.length).toBe(280);
  });

  it('NEVER truncates credential field (up to 50 chars in v2)', () => {
    const result = normalizeProvider(makeRawResponse({ credential: LONG_CREDENTIAL }));
    expect(result.credential).toBe(LONG_CREDENTIAL);
    expect(result.credential.length).toBe(45);
  });

  it('builds display_name from name parts when no organization', () => {
    const result = normalizeProvider(makeRawResponse({ first_name: 'John', last_name: 'Doe', credential: 'DO' }));
    expect(result.display_name).toContain('John');
    expect(result.display_name).toContain('Doe');
    expect(result.display_name).toContain('DO');
  });

  it('uses organization_name as display_name for NPI-2', () => {
    const result = normalizeProvider(makeRawResponse({ organization_name: 'UCSF Medical Center', enumeration_type: 'NPI-2' }));
    expect(result.display_name).toBe('UCSF Medical Center');
  });

  it('normalizes practice_address with all address fields', () => {
    const result = normalizeProvider(makeRawResponse({}, { address_1: '456 Hospital Blvd', city: 'Los Angeles', state: 'CA', postal_code: '90001' }));
    expect(result.practice_address?.address_1).toBe('456 Hospital Blvd');
    expect(result.practice_address?.city).toBe('Los Angeles');
    expect(result.practice_address?.state).toBe('CA');
  });

  it('throws 404 when result_count is 0', () => {
    expect(() => normalizeProvider({ result_count: 0, results: [] })).toThrow();
  });

  it('throws 422 when status field is missing', () => {
    expect(() =>
      normalizeProvider({ result_count: 1, results: [{ ...makeRawResult(), basic: { ...makeRawResult().basic, status: '' } }] }),
    ).toThrow();
  });

  it('handles missing optional fields gracefully', () => {
    const result = normalizeProvider(makeRawResponse({ middle_name: '', name_prefix: '', name_suffix: '' }));
    expect(result.middle_name).toBe('');
    expect(result.name_prefix).toBe('');
  });
});

// ── smokeTestNppesResult ──────────────────────────────────────────────────

describe('smokeTestNppesResult', () => {
  it('passes for a complete well-formed NPPES result', () => {
    const sample = smokeTestNppesResult(makeRawResult());
    expect(sample.passes).toBe(true);
    expect(sample.warnings).toHaveLength(0);
    expect(sample.npi).toBe('1234567890');
  });

  it('warns when address_1 exceeds 200 chars', () => {
    const sample = smokeTestNppesResult(makeRawResult({}, { address_1: LONG_ADDRESS + LONG_ADDRESS }));
    expect(sample.warnings.some((w) => w.includes('address_1'))).toBe(true);
  });

  it('warns when organization_name exceeds 300 chars', () => {
    const sample = smokeTestNppesResult(makeRawResult({ organization_name: LONG_ORG_NAME + LONG_ORG_NAME }));
    expect(sample.warnings.some((w) => w.includes('organization_name'))).toBe(true);
  });

  it('reports fields_missing for empty required fields', () => {
    const result = makeRawResult({ first_name: '' });
    const sample = smokeTestNppesResult(result);
    expect(sample.fields_missing).toContain('first_name');
  });

  it('reports correct taxonomy_count', () => {
    const sample = smokeTestNppesResult(makeRawResult());
    expect(sample.taxonomy_count).toBe(1);
  });

  it('does not throw on malformed input', () => {
    expect(() => smokeTestNppesResult({ ...makeRawResult(), addresses: [] })).not.toThrow();
    expect(() => smokeTestNppesResult({ ...makeRawResult(), taxonomies: [] })).not.toThrow();
  });
});
