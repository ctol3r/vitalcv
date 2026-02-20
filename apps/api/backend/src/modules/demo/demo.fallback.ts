import type { NormalizedProvider, IdentityArtifact } from '../identity/types';

/**
 * Hardcoded sample providers used when CMS NPPES is unreachable.
 * These are real NPIs that produce valid NPPES responses.
 */
export const SAMPLE_PROVIDERS: Record<string, NormalizedProvider> = {
  '1003000126': {
    npi: '1003000126',
    enumeration_type: 'NPI-1',
    status: 'A',
    first_name: 'ROBERT',
    last_name: 'SMITH',
    primary_taxonomy: 'Internal Medicine',
  },
  '1497758544': {
    npi: '1497758544',
    enumeration_type: 'NPI-1',
    status: 'A',
    first_name: 'MARY',
    last_name: 'JOHNSON',
    primary_taxonomy: 'Family Medicine',
  },
  '1588667638': {
    npi: '1588667638',
    enumeration_type: 'NPI-1',
    status: 'A',
    first_name: 'JAMES',
    last_name: 'WILLIAMS',
    primary_taxonomy: 'Nurse Practitioner',
  },
};

export const SAMPLE_NPI_LIST = Object.entries(SAMPLE_PROVIDERS).map(
  ([npi, provider]) => ({
    npi,
    name: `${provider.first_name} ${provider.last_name}`,
    specialty: provider.primary_taxonomy,
  }),
);

export function getCachedProvider(npi: string): NormalizedProvider | null {
  return SAMPLE_PROVIDERS[npi] ?? null;
}

export function getCachedArtifact(npi: string): {
  artifact: IdentityArtifact;
  artifact_hash: string;
} | null {
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

  return {
    artifact,
    artifact_hash: 'cached-no-hash-available',
  };
}
