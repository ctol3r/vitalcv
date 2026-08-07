/**
 * Identity module types — strict interfaces for NPPES identity validation.
 *
 * NPPES v2 field-length changes (2023-2025):
 *   address_1, address_2 → up to 200 chars (was 55)
 *   city                 → up to 40 chars
 *   organization_name    → up to 300 chars (was 70)
 *   credential           → up to 50 chars (was 20)
 *   taxonomy.desc        → up to 100 chars
 *   license              → up to 20 chars
 *
 * IMPORTANT: All fields that NPPES v2 expanded must be typed as `string`
 * (TEXT in DB) — never truncated, never sliced. Raw payload must be preserved.
 */

// ── Raw NPPES shapes ───────────────────────────────────────────────────────

/** Raw taxonomy entry from CMS NPPES API v2.1 */
export interface RawNppesTaxonomy {
  code: string;
  taxonomy_group: string;
  /** Up to 100 chars in v2 — never truncate */
  desc: string;
  /** 2-letter state code */
  state: string;
  /** Up to 20 chars in v2 */
  license: string;
  primary: boolean;
}

/** Raw address block from CMS NPPES API v2.1 */
export interface RawNppesAddress {
  country_code: string;
  country_name: string;
  /** LOCATION | MAILING */
  address_purpose: string;
  address_type: string;
  /** Up to 200 chars in v2 — never truncate */
  address_1: string;
  address_2?: string;
  /** Up to 40 chars in v2 */
  city: string;
  /** 2-letter state code */
  state: string;
  postal_code: string;
  telephone_number?: string;
  fax_number?: string;
}

/** Raw identifier block (DEA, state license, etc.) */
export interface RawNppesIdentifier {
  code: string;
  desc?: string;
  issuer?: string;
  identifier: string;
  state?: string;
}

/** Raw endpoint block from CMS NPPES API v2.1 */
export interface RawNppesEndpoint {
  endpoint?: string;
  endpointType?: string;
  endpointTypeDescription?: string;
  endpointUrl?: string;
  affiliation?: string;
  contentType?: string;
  contentDescription?: string;
  useDescription?: string;
}

/** Raw alternate-name block from CMS NPPES API v2.1 */
export interface RawNppesOtherName {
  organization_name?: string;
  first_name?: string;
  last_name?: string;
  type_code?: string;
  type?: string;
}

/** Raw basic info block from CMS NPPES API v2.1 */
export interface RawNppesBasic {
  first_name: string;
  last_name: string;
  middle_name: string;
  /** Up to 50 chars in v2 — MD, DO, NP, etc. */
  credential: string;
  /** "YES" | "NO" — sole proprietor flag (individuals only) */
  sole_proprietor: string;
  /**
   * Administrative sex as recorded by CMS.
   *
   * NPPES v2.1 emits `sex` ("M" | "F"). Older v2.0 payloads emitted `gender`.
   * Both are declared so the normalizer can read whichever is present; `sex`
   * wins when both appear. This is CMS's own registry field, not a statement
   * about gender identity, and it is surfaced as such.
   */
  sex?: string;
  /** @deprecated NPPES v2.0 spelling — superseded by `sex`. Read-only fallback. */
  gender?: string;
  enumeration_date: string;
  last_updated: string;
  /** Date the provider last certified the record's accuracy with CMS */
  certification_date?: string;
  /** "A" = Active — authoritative status field */
  status: string;
  /** Set when `status` is "D" (deactivated) */
  deactivation_date?: string;
  deactivation_reason_code?: string;
  /** Set when a deactivated NPI has been restored */
  reactivation_date?: string;
  name_prefix: string;
  name_suffix: string;
  enumeration_type: string;
  /** Up to 300 chars in v2 — never truncate */
  organization_name?: string;

  // ── Type-2 (organization) only ──────────────────────────────────────────
  /** "YES" | "NO" — whether this org is a subpart of a parent organization */
  organizational_subpart?: string;
  parent_organization_legal_business_name?: string;
  parent_organization_ein?: string;
  authorized_official_first_name?: string;
  authorized_official_last_name?: string;
  authorized_official_middle_name?: string;
  authorized_official_name_prefix?: string;
  authorized_official_name_suffix?: string;
  authorized_official_credential?: string;
  authorized_official_title_or_position?: string;
  authorized_official_telephone_number?: string;
}

/** Single result entry from CMS NPPES API v2.1 */
export interface RawNppesResult {
  created_epoch: number;
  /** NPI-1 (individual) | NPI-2 (organization) */
  enumeration_type: string;
  last_updated_epoch: number;
  /** 10-digit NPI as string */
  number: string;
  basic: RawNppesBasic;
  taxonomies: RawNppesTaxonomy[];
  addresses: RawNppesAddress[];
  identifiers: RawNppesIdentifier[];
  endpoints: RawNppesEndpoint[];
  other_names: RawNppesOtherName[];
  /**
   * Secondary practice locations, distinct from `addresses`.
   *
   * CMS emits this key in camelCase (unlike every other field on the result),
   * and it is frequently absent rather than empty. It carries the practice
   * sites a provider works at beyond the single LOCATION address, which is
   * why a registry mirror that reads only `addresses` under-reports where a
   * clinician actually practises.
   */
  practiceLocations?: RawNppesAddress[];
}

/** Top-level CMS NPPES API response */
export interface RawNppesResponse {
  result_count: number;
  results: RawNppesResult[];
}

// ── Normalized shapes ──────────────────────────────────────────────────────

/** Full taxonomy entry after normalization — no truncation */
export interface NormalizedTaxonomy {
  code: string;
  taxonomy_group: string;
  /** Full description — TEXT field */
  desc: string;
  state: string;
  /** Full license number — TEXT field */
  license: string;
  primary: boolean;
}

/** Full address after normalization */
export interface NormalizedAddress {
  purpose: 'LOCATION' | 'MAILING' | string;
  /** DOM (domestic) | FGN (foreign) | MIL (military) */
  address_type: string;
  /** Full address line — TEXT field (up to 200 chars in v2) */
  address_1: string;
  address_2: string;
  /** Full city — TEXT field */
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  country_name: string;
  telephone_number: string;
  fax_number: string;
}

export interface NormalizedEndpoint {
  endpoint: string;
  endpointType: string;
  endpointTypeDescription: string;
  affiliation: string;
}

export interface NormalizedOtherName {
  display_name: string;
  type: string;
}

/**
 * Type-2 authorized official — the natural person CMS holds accountable for
 * an organization's NPI record. Null for individual (NPI-1) providers.
 */
export interface NormalizedAuthorizedOfficial {
  display_name: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  name_prefix: string;
  name_suffix: string;
  credential: string;
  title_or_position: string;
  telephone_number: string;
}

/**
 * Normalized provider record extracted from raw NPPES data.
 *
 * All string fields are TEXT-safe — no max-length assumptions.
 * Downstream persistence must use TEXT or VARCHAR(n >= 300) for names,
 * VARCHAR(n >= 200) for addresses, and VARCHAR(n >= 50) for credentials.
 */
export interface NormalizedProvider {
  /** 10-digit NPI */
  npi: string;
  /** NPI-1 | NPI-2 */
  enumeration_type: string;
  /** NPPES status: "A" (Active) | "D" (Deactivated) | "O" (Other) */
  status: string;

  // ── Name fields ──────────────────────────────────────────────────────
  first_name: string;
  last_name: string;
  middle_name: string;
  /** Credential suffix: MD, DO, NP, etc. (up to 50 chars v2) */
  credential: string;
  name_prefix: string;
  name_suffix: string;
  /** Full org name — TEXT field (up to 300 chars v2) */
  organization_name: string;
  /** Display name — full name or org name, never truncated */
  display_name: string;

  // ── Demographics ──────────────────────────────────────────────────────
  /**
   * CMS administrative sex code: "M" | "F" | "" when not recorded.
   * Registry metadata, not an identity claim — render it labelled as such.
   */
  sex: string;
  /** "YES" | "NO" | "" — sole-proprietor election (individuals only) */
  sole_proprietor: string;

  // ── Classification ────────────────────────────────────────────────────
  /** Primary taxonomy description — full TEXT */
  primary_taxonomy: string | null;
  /** Primary taxonomy code */
  primary_taxonomy_code: string | null;
  /** All taxonomies with full license and description */
  taxonomies: NormalizedTaxonomy[];

  // ── Location ──────────────────────────────────────────────────────────
  /** Practice location address — TEXT fields */
  practice_address: NormalizedAddress | null;
  /** Mailing address — TEXT fields */
  mailing_address: NormalizedAddress | null;
  /** All addresses */
  addresses: NormalizedAddress[];
  /** Secondary practice sites from the `practiceLocations` key */
  practice_locations: NormalizedAddress[];

  // ── Identifiers ───────────────────────────────────────────────────────
  identifiers: RawNppesIdentifier[];
  endpoints: NormalizedEndpoint[];
  other_names: NormalizedOtherName[];

  // ── Organization (Type-2) ─────────────────────────────────────────────
  /** "YES" | "NO" | "" */
  organizational_subpart: string;
  parent_organization_legal_business_name: string;
  /** Null for individual (NPI-1) providers */
  authorized_official: NormalizedAuthorizedOfficial | null;

  // ── Audit ─────────────────────────────────────────────────────────────
  enumeration_date: string;
  last_updated: string;
  /** Date the provider last certified record accuracy with CMS */
  certification_date: string;
  /** Populated only when the NPI is deactivated */
  deactivation_date: string;
  deactivation_reason_code: string;
  /** Populated only when a deactivated NPI was restored */
  reactivation_date: string;
  /** CMS epoch timestamps (ms as string) — exact machine-readable audit anchors */
  created_epoch: string;
  last_updated_epoch: string;
}

// ── Smoke test result ─────────────────────────────────────────────────────

export interface NppesSmokeSample {
  npi: string;
  fields_present: string[];
  fields_missing: string[];
  address_1_length: number;
  org_name_length: number;
  credential_length: number;
  taxonomy_count: number;
  passes: boolean;
  warnings: string[];
}

// ── Source / artifact shapes ───────────────────────────────────────────────

export interface ArtifactSource {
  system: string;
  endpoint: string;
  retrieved_at: string;
}

export interface ArtifactRawCapture {
  payload_sha256: string;
  storage_ref: string;
}

export interface IdentityArtifact {
  schema_version: string;
  artifact_version: string;
  artifact_type: string;
  provider: NormalizedProvider;
  source: ArtifactSource;
  raw_capture: ArtifactRawCapture;
}

export interface IdentityArtifactSigned {
  artifact: IdentityArtifact;
  artifact_hash: string;
  signature: string;
}

export interface NppesFetchResult {
  rawPayload: RawNppesResponse;
  payloadHash: string;
}

export interface ArtifactGenerationResult {
  artifact: IdentityArtifact;
  artifact_hash: string;
}
