/**
 * directory-evidence-fetch-stub.mjs — LOCAL EVIDENCE CAPTURE ONLY.
 *
 * A Node `--import` preload for `next start` that answers the two federal
 * upstreams /directory/[npi] reads — NPPES and the CMS Doctors & Clinicians
 * file — with a sanctioned SYNTHETIC fixture, so the founder-gate screenshots
 * can be captured from a production build without rendering any real
 * person's registry record into committed evidence, and without touching a
 * federal API from a screenshot loop.
 *
 * The NPIs answered are the two the directory tests already sanction
 * (directory-claim-entry.test.tsx): 1558395516 (check-digit-invalid,
 * individual, absent from NPPES) and 1558395511 (organization). Every other
 * URL passes through to the real fetch untouched.
 *
 * Usage (from apps/web, after `next build`):
 *   NODE_OPTIONS="--import /abs/path/to/this/file" \
 *     node node_modules/next/dist/bin/next start -p 3077
 *
 * This file is harness, not product: nothing imports it, and no deploy path
 * references it.
 */

const INDIVIDUAL = {
  number: '1558395516',
  enumeration_type: 'NPI-1',
  created_epoch: '1577836800',
  last_updated_epoch: '1767225600',
  basic: {
    first_name: 'EXAMPLE',
    last_name: 'CLINICIAN',
    middle_name: '',
    credential: 'PA-C',
    sole_proprietor: 'NO',
    sex: 'F',
    status: 'A',
    enumeration_date: '2020-01-01',
    last_updated: '2026-01-01',
    certification_date: '2020-01-01',
  },
  addresses: [
    {
      address_purpose: 'LOCATION',
      address_type: 'DOM',
      address_1: '1 EXAMPLE WAY',
      address_2: '',
      city: 'AUSTIN',
      state: 'TX',
      postal_code: '787010000',
      country_code: 'US',
      country_name: 'United States',
      telephone_number: '512-555-0100',
    },
    {
      address_purpose: 'MAILING',
      address_type: 'DOM',
      address_1: '1 EXAMPLE WAY',
      address_2: '',
      city: 'AUSTIN',
      state: 'TX',
      postal_code: '787010000',
      country_code: 'US',
      country_name: 'United States',
    },
  ],
  taxonomies: [
    {
      code: '363A00000X',
      taxonomy_group: '',
      desc: 'Physician Assistant',
      state: 'TX',
      license: 'PA00000',
      primary: true,
    },
  ],
  identifiers: [],
  endpoints: [],
  other_names: [],
  practiceLocations: [],
};

const ORGANIZATION = {
  number: '1558395511',
  enumeration_type: 'NPI-2',
  created_epoch: '1577836800',
  last_updated_epoch: '1767225600',
  basic: {
    organization_name: 'EXAMPLE CLINIC INC',
    organizational_subpart: 'NO',
    status: 'A',
    enumeration_date: '2020-01-01',
    last_updated: '2026-01-01',
    certification_date: '2020-01-01',
    authorized_official_first_name: 'EXAMPLE',
    authorized_official_last_name: 'OFFICIAL',
    authorized_official_title_or_position: 'ADMINISTRATOR',
    authorized_official_telephone_number: '512-555-0101',
  },
  addresses: [
    {
      address_purpose: 'LOCATION',
      address_type: 'DOM',
      address_1: '2 EXAMPLE PLAZA',
      address_2: '',
      city: 'AUSTIN',
      state: 'TX',
      postal_code: '787010000',
      country_code: 'US',
      country_name: 'United States',
      telephone_number: '512-555-0102',
    },
  ],
  taxonomies: [
    {
      code: '261Q00000X',
      taxonomy_group: '',
      desc: 'Clinic/Center',
      state: '',
      license: '',
      primary: true,
    },
  ],
  identifiers: [],
  endpoints: [],
  other_names: [],
  practiceLocations: [],
};

const FIXTURES = new Map([
  ['1558395516', INDIVIDUAL],
  ['1558395511', ORGANIZATION],
]);

const realFetch = globalThis.fetch;

globalThis.fetch = async function evidenceFetch(input, init) {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input && input.url) || String(input);

  if (url.includes('npiregistry.cms.hhs.gov')) {
    const npi = new URL(url).searchParams.get('number');
    const fixture = npi ? FIXTURES.get(npi) : undefined;
    const body = fixture
      ? { result_count: 1, results: [fixture] }
      : { result_count: 0, results: [] };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (url.includes('data.cms.gov')) {
    // Empty result set → the honest 'not_listed' state renders.
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  return realFetch(input, init);
};

console.log('[directory-evidence-fetch-stub] armed: NPPES + data.cms.gov answered locally');
