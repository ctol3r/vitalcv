/**
 * npiRouter.ts — NPI Type Branching + Entity Resolution
 *
 * Resolves an NPI to a canonical entity type and routes to the correct
 * workflow context. This is the entry point for all NPI-based operations.
 *
 * Design:
 *   - NPI type is a ROUTING SIGNAL, not a role assignment.
 *   - Type 1 → person entity → clinician-first workflow.
 *   - Type 2 → organization entity → employer/verifier workflow.
 *   - Resolution may fall back to cached data if NPPES is unavailable.
 *   - Never invents data — returns UNKNOWN status if resolution fails.
 *
 * Consumers:
 *   - Homepage NPI submit → resolve → route to correct workflow
 *   - Ingest pipeline → resolve entity type before claim derivation
 *   - Identity layer → know what kind of entity a claim belongs to
 */

import { createHash } from 'node:crypto';
import { log }        from '../../obs/logger';
import {
  NPI_TYPE_ROUTING,
  type NpiType,
  type NpiResolution,
  type EntityType,
  type CanonicalEntity,
  type EntityMetadata,
} from './types';
import { makeNpiRoutingDecision } from './contracts';

const NPI_RE = /^\d{10}$/;
const NPPES_URL = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
const TIMEOUT_MS = 8_000;

// ── NPPES raw shapes ──────────────────────────────────────────────────────────

interface NppesBasic {
  first_name?:        string;
  last_name?:         string;
  middle_name?:       string;
  name_prefix?:       string;
  credential?:        string;
  organization_name?: string;
  status?:            string;         // 'A' = active, 'D' = deactivated
  enumeration_date?:  string;
  last_updated?:      string;
  gender?:            string;
}

interface NppesTaxonomy {
  code?:    string;
  desc?:    string;
  state?:   string;
  license?: string;
  primary?: boolean;
}

interface NppesAddress {
  address_purpose?: string;
  address_1?:       string;
  city?:            string;
  state?:           string;
  postal_code?:     string;
  country_code?:    string;
  telephone_number?: string;
}

interface NppesRecord {
  number?:           string | number;
  enumeration_type?: string;    // 'NPI-1' or 'NPI-2'
  basic?:            NppesBasic;
  taxonomies?:       NppesTaxonomy[];
  addresses?:        NppesAddress[];
}

interface NppesResponse {
  result_count?: number;
  results?:      NppesRecord[];
}

// ── Canonical ID derivation ───────────────────────────────────────────────────

/**
 * Deterministic canonical ID for an entity.
 * Same entity always produces the same canonicalId — safe to use as a lookup key.
 */
export function deriveCanonicalId(entityType: EntityType, primaryKey: string): string {
  return createHash('sha256')
    .update(`${entityType}:${primaryKey}`)
    .digest('hex')
    .slice(0, 32);
}

// ── NPI resolution ────────────────────────────────────────────────────────────

/**
 * Validate an NPI string. Returns true if it is a 10-digit numeric string.
 * Does NOT validate the Luhn check digit — that would require an additional
 * pass and is not required for our use case (NPPES validates at source).
 */
export function isValidNpi(npi: string): boolean {
  return NPI_RE.test(npi);
}

/**
 * Classify an NPI enumeration_type string to our NpiType enum.
 */
export function classifyEnumerationType(enumerationType: string | undefined): NpiType {
  if (enumerationType === 'NPI-2') return 'TYPE_2';
  return 'TYPE_1'; // default — NPI-1 or unknown → treat as individual
}

/**
 * Extract a display name from NPPES basic data.
 */
function extractDisplayName(basic: NppesBasic, enumerationType: string | undefined): string {
  if (enumerationType === 'NPI-2') {
    return basic.organization_name ?? 'Unknown Organization';
  }
  const parts: string[] = [];
  if (basic.name_prefix) parts.push(basic.name_prefix);
  if (basic.first_name)  parts.push(basic.first_name);
  if (basic.middle_name) parts.push(basic.middle_name);
  if (basic.last_name)   parts.push(basic.last_name);
  if (basic.credential)  parts.push(`, ${basic.credential}`);
  const name = parts.join(' ').replace(/\s,/, ',').trim();
  return name || 'Unknown Provider';
}

/**
 * Extract primary specialty from taxonomies.
 */
function extractPrimarySpecialty(taxonomies: NppesTaxonomy[]): string | undefined {
  const primary = taxonomies.find(t => t.primary) ?? taxonomies[0];
  return primary?.desc;
}

/**
 * Map NPPES basic status to our status type.
 */
function mapNppesStatus(status: string | undefined): NpiResolution['status'] {
  if (status === 'A') return 'ACTIVE';
  if (status === 'D') return 'DEACTIVATED';
  return 'UNKNOWN';
}

/**
 * Build a CanonicalEntity from a resolved NPPES record.
 * This is a "best-effort" entity — may be enriched by further ingestion.
 */
export function buildEntityFromNppesRecord(record: NppesRecord): CanonicalEntity {
  const npi            = String(record.number ?? '');
  const enumerationType = record.enumeration_type;
  const npiType        = classifyEnumerationType(enumerationType);
  const entityType: EntityType = npiType === 'TYPE_2' ? 'organization' : 'person';
  const basic          = record.basic ?? {};
  const displayName    = extractDisplayName(basic, enumerationType);
  const taxonomies     = record.taxonomies ?? [];
  const addresses      = record.addresses ?? [];

  const metadata: EntityMetadata = {
    firstName:    basic.first_name,
    lastName:     basic.last_name,
    credential:   basic.credential,
    gender:       basic.gender,
    orgName:      basic.organization_name,
    addresses:    addresses.map(a => ({
      type:    (a.address_purpose === 'MAILING' ? 'MAILING' : 'PRACTICE') as 'MAILING' | 'PRACTICE' | 'HEADQUARTERS',
      line1:   a.address_1 ?? '',
      city:    a.city ?? '',
      state:   a.state ?? '',
      zip:     a.postal_code ?? '',
      country: a.country_code ?? 'US',
    })),
    taxonomies:   taxonomies.map(t => ({
      code:    t.code ?? '',
      desc:    t.desc ?? '',
      state:   t.state,
      license: t.license,
      primary: t.primary ?? false,
    })),
  };

  const now = new Date().toISOString();
  return {
    id:          '', // set by persistence layer
    entityType,
    canonicalId: deriveCanonicalId(entityType, npi),
    displayName,
    npi,
    npiType,
    sourceIds:   ['NPPES_API'],
    verifiedAt:  now,
    metadata,
    createdAt:   now,
    updatedAt:   now,
  };
}

// ── Main resolution function ──────────────────────────────────────────────────

/**
 * Resolve an NPI to a canonical entity + workflow context.
 *
 * Always returns a result — on network failure, returns UNKNOWN status
 * with the correct NPI type if it can be inferred from a cached record,
 * or falls back to TYPE_1 (most common) as a routing default.
 *
 * NEVER invents a verified status. On failure, caller must handle gracefully.
 */
export async function resolveNpi(npi: string): Promise<NpiResolution> {
  if (!isValidNpi(npi)) {
    throw new Error(`Invalid NPI: ${npi} — must be a 10-digit numeric string`);
  }

  const url = `${NPPES_URL}&number=${encodeURIComponent(npi)}`;

  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resp.ok) {
      log('warn', 'npiRouter: NPPES returned non-200', { npi, status: resp.status });
      return unknownResolution(npi);
    }

    const data = await resp.json() as NppesResponse;

    if (!data.result_count || !data.results?.length) {
      log('info', 'npiRouter: NPI not found in NPPES', { npi });
      return {
        npi,
        npiType:         'TYPE_1',
        enumerationType: 'NPI-1',
        entityType:      'person',
        suggestedRoles:  ['clinician'],
        routingContext:  'prove_readiness',
        displayName:     'Provider not found in NPPES',
        status:          'UNKNOWN',
        source:          'NPPES_API',
        resolvedAt:      new Date().toISOString(),
      };
    }

    const record          = data.results[0];
    const enumerationType = record.enumeration_type as 'NPI-1' | 'NPI-2' | undefined;
    const npiType         = classifyEnumerationType(enumerationType);
    const routing         = NPI_TYPE_ROUTING[npiType];
    const basic           = record.basic ?? {};
    const displayName     = extractDisplayName(basic, enumerationType);
    const specialty       = extractPrimarySpecialty(record.taxonomies ?? []);
    const status          = mapNppesStatus(basic.status);
    
    const credentials     = basic.credential;
    const taxonomies      = (record.taxonomies ?? []).map(t => ({
      code: t.code ?? '',
      desc: t.desc ?? '',
      state: t.state,
      license: t.license,
      primary: t.primary ?? false,
    }));
    const enumerationDate = basic.enumeration_date;
    const primaryAddress  = record.addresses?.find(a => a.address_purpose === 'LOCATION') ?? record.addresses?.[0];
    const address         = primaryAddress ? {
      line1: primaryAddress.address_1 ?? '',
      city: primaryAddress.city ?? '',
      state: primaryAddress.state ?? '',
      zip: primaryAddress.postal_code ?? '',
      country: primaryAddress.country_code ?? 'US',
      phone: primaryAddress.telephone_number,
    } : undefined;

    const routingDecision = makeNpiRoutingDecision(npi, enumerationType, 'NPPES_API');
    log('info', 'npiRouter: resolved', {
      npi, npiType, entityType: routing.entityType, displayName, status,
      routingEntry: routingDecision.workflowEntry,
    });

    return {
      npi,
      npiType,
      enumerationType:  enumerationType ?? 'NPI-1',
      entityType:       routing.entityType,
      suggestedRoles:   routing.primaryRoles,
      routingContext:   routing.workflowContext,
      displayName,
      specialty,
      credentials,
      taxonomies,
      enumerationDate,
      address,
      status,
      source:          'NPPES_API',
      resolvedAt:      new Date().toISOString(),
      // S3: canonical routing decision attached for consumers
      routingDecision,
    };

  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    log('warn', 'npiRouter: NPPES fetch failed', { npi, error: String(err), isTimeout });
    return unknownResolution(npi);
  }
}

function unknownResolution(npi: string): NpiResolution {
  return {
    npi,
    npiType:         'TYPE_1',     // safe routing default
    enumerationType: 'NPI-1',
    entityType:      'person',
    suggestedRoles:  ['clinician'],
    routingContext:  'prove_readiness',
    displayName:     'Resolution unavailable',
    status:          'UNKNOWN',
    source:          'NPPES_API',
    resolvedAt:      new Date().toISOString(),
  };
}

// ── Role validation helpers ───────────────────────────────────────────────────

/**
 * Validate that a given entity type is eligible for a role.
 * Returns true if the assignment is valid per ROLE_ELIGIBILITY rules.
 */
export function canAssignRole(
  entityType: EntityType,
  roleType:   import('./types').RoleType,
): boolean {
  const { ROLE_ELIGIBILITY } = require('./types') as typeof import('./types');
  const allowed = ROLE_ELIGIBILITY[roleType] ?? [];
  return allowed.includes(entityType);
}

/**
 * Validate a relationship triple (subject type → relationship → object type).
 */
export function isValidRelationship(
  subjectType:      EntityType,
  relationshipType: import('./types').RelationshipType,
  objectType:       EntityType,
): boolean {
  const { RELATIONSHIP_RULES } = require('./types') as typeof import('./types');
  return RELATIONSHIP_RULES.some(
    rule =>
      rule.subject.includes(subjectType) &&
      rule.relationship === relationshipType &&
      rule.object.includes(objectType),
  );
}
