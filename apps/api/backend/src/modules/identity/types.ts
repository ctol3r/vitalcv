/**
 * Identity module types — strict interfaces for NPPES identity validation.
 */

/** Raw taxonomy entry from CMS NPPES API v2.1 */
export interface RawNppesTaxonomy {
  code: string;
  taxonomy_group: string;
  desc: string;
  state: string;
  license: string;
  primary: boolean;
}

/** Raw basic info block from CMS NPPES API v2.1 */
export interface RawNppesBasic {
  first_name: string;
  last_name: string;
  middle_name: string;
  credential: string;
  sole_proprietor: string;
  gender: string;
  enumeration_date: string;
  last_updated: string;
  status: string;
  name_prefix: string;
  name_suffix: string;
  enumeration_type: string;
  organization_name?: string;
}

/** Single result entry from CMS NPPES API v2.1 */
export interface RawNppesResult {
  created_epoch: number;
  enumeration_type: string;
  last_updated_epoch: number;
  number: string;
  basic: RawNppesBasic;
  taxonomies: RawNppesTaxonomy[];
  addresses: unknown[];
  identifiers: unknown[];
  endpoints: unknown[];
  other_names: unknown[];
}

/** Top-level CMS NPPES API response */
export interface RawNppesResponse {
  result_count: number;
  results: RawNppesResult[];
}

/** Normalized provider extracted from raw NPPES data */
export interface NormalizedProvider {
  npi: string;
  enumeration_type: string;
  status: string;
  first_name: string;
  last_name: string;
  primary_taxonomy: string | null;
}

/** Source metadata for an identity artifact */
export interface ArtifactSource {
  system: string;
  endpoint: string;
  retrieved_at: string;
}

/** Raw capture hash for audit trail */
export interface ArtifactRawCapture {
  payload_sha256: string;
  storage_ref: string;
}

/** Unsigned identity validation artifact */
export interface IdentityArtifact {
  schema_version: string;
  artifact_version: string;
  artifact_type: string;
  provider: NormalizedProvider;
  source: ArtifactSource;
  raw_capture: ArtifactRawCapture;
}

/** Signed identity artifact with JWS compact serialization */
export interface IdentityArtifactSigned {
  artifact: IdentityArtifact;
  artifact_hash: string;
  signature: string;
}

/** Result from NPPES service fetch */
export interface NppesFetchResult {
  rawPayload: RawNppesResponse;
  payloadHash: string;
}

/** Result from artifact generation */
export interface ArtifactGenerationResult {
  artifact: IdentityArtifact;
  artifact_hash: string;
}
