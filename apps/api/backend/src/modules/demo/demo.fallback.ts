import type { NormalizedProvider, IdentityArtifact } from '../identity/types';

/**
 * Hardcoded sample providers used when CMS NPPES is unreachable.
 * Updated for NormalizedProvider v2 (Wave A — NPPES hardening).
 */

const EMPTY_ADDRESS = {
  purpose: 'LOCATION' as const,
  address_1: '',
  address_2: '',
  city: '',
  state: '',
  postal_code: '',
  country_code: 'US',
  telephone_number: '',
};

function makeProvider(
  npi: string,
  first_name: string,
  last_name: string,
  primary_taxonomy: string,
  primary_taxonomy_code: string,
  state = 'CA',
  license = '',
): NormalizedProvider {
  return {
    npi,
    enumeration_type: 'NPI-1',
    status: 'A',
    first_name,
    last_name,
    middle_name: '',
    credential: 'MD',
    name_prefix: '',
    name_suffix: '',
    organization_name: '',
    display_name: `${first_name} ${last_name}, MD`,
    primary_taxonomy,
    primary_taxonomy_code,
    taxonomies: [{ code: primary_taxonomy_code, taxonomy_group: '', desc: primary_taxonomy, state, license, primary: true }],
    practice_address: { ...EMPTY_ADDRESS, state },
    mailing_address: null,
    addresses: [{ ...EMPTY_ADDRESS, state }],
    identifiers: [],
    endpoints: [],
    other_names: [],
    enumeration_date: '2010-01-01',
    last_updated: '2024-01-01',
  };
}

export const SAMPLE_PROVIDERS: Record<string, NormalizedProvider> = {
  '1003000126': makeProvider('1003000126', 'ROBERT', 'SMITH', 'Internal Medicine', '207R00000X', 'CA', 'A100001'),
  '1497758544': makeProvider('1497758544', 'MARY', 'JOHNSON', 'Family Medicine', '207Q00000X', 'NY', 'NY100001'),
  '1588667638': makeProvider('1588667638', 'JAMES', 'WILLIAMS', 'Nurse Practitioner', '363L00000X', 'TX', 'TX100001'),
};

export const SAMPLE_NPI_LIST = Object.entries(SAMPLE_PROVIDERS).map(([npi, provider]) => ({
  npi,
  name: provider.display_name,
  specialty: provider.primary_taxonomy,
}));

export function getCachedProvider(npi: string): NormalizedProvider | null {
  return SAMPLE_PROVIDERS[npi] ?? null;
}

export function getCachedArtifact(npi: string): { artifact: IdentityArtifact; artifact_hash: string } | null {
  const provider = getCachedProvider(npi);
  if (!provider) return null;

  const artifact: IdentityArtifact = {
    schema_version: 'vcv-identity-2026-01',
    artifact_version: '1.0',
    artifact_type: 'nppes_identity_validation',
    provider,
    source: {
      system: 'CMS NPPES Registry (cached)',
      endpoint: 'https://npiregistry.cms.hhs.gov/api/?version=2.1',
      retrieved_at: new Date().toISOString(),
    },
    raw_capture: {
      payload_sha256: 'cached-no-hash-available',
      storage_ref: 'demo-fallback',
    },
  };

  return { artifact, artifact_hash: 'cached-no-hash-available' };
}
