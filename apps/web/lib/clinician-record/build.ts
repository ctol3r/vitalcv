/**
 * build.ts — assemble a ClinicianRecord from an NPPES reading.
 *
 * The builder is a pure transform: no fetching, no DB writes, no audit
 * events. Give it a normalized NPPES payload and the moment it was read, and
 * it returns the record. That keeps it testable against real CMS payloads and
 * keeps provenance honest, since the caller must state when it read.
 *
 * Federal connectors (PECOS, OIG, CMS Doctors & Clinicians) attach to the
 * record downstream; they do not belong in this function.
 */

import { buildCanonicalSourceCoverageFreshness } from '@vitalcv/trust-state';
import { describeTaxonomies, selfReportedLicenseStates } from '@/lib/reference/taxonomy';
import { decodeCredential } from '@/lib/reference/credentials';
import { NPPES_SOURCE, VITALCV_DERIVED_SOURCE, type SourceDescriptor } from './sources';
import type {
  ClinicianRecord,
  FieldProvenance,
  RecordAddress,
  RecordFreshness,
  RecordGap,
  RecordSection,
  RecordStatus,
} from './types';

// ── Input shape ────────────────────────────────────────────────────────────
// Mirrors NormalizedProvider from the backend identity module. Declared
// structurally rather than imported so apps/web does not take a build-time
// dependency on apps/api/backend; the shared field names are the contract.

export interface NppesReading {
  npi: string;
  enumeration_type: string;
  status: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  credential: string;
  name_prefix: string;
  name_suffix: string;
  organization_name: string;
  display_name: string;
  sex: string;
  sole_proprietor: string;
  primary_taxonomy: string | null;
  primary_taxonomy_code: string | null;
  taxonomies: Array<{
    code: string;
    taxonomy_group: string;
    desc: string;
    state: string;
    license: string;
    primary: boolean;
  }>;
  practice_address: RawAddress | null;
  mailing_address: RawAddress | null;
  addresses: RawAddress[];
  practice_locations: RawAddress[];
  identifiers: Array<{
    code?: string;
    desc?: string;
    issuer?: string;
    identifier: string;
    state?: string;
  }>;
  endpoints: Array<{
    endpoint: string;
    endpointType: string;
    endpointTypeDescription: string;
    affiliation: string;
  }>;
  other_names: Array<{ display_name: string; type: string }>;
  organizational_subpart: string;
  parent_organization_legal_business_name: string;
  authorized_official: {
    display_name: string;
    title_or_position: string;
    telephone_number: string;
    credential: string;
  } | null;
  enumeration_date: string;
  last_updated: string;
  certification_date: string;
  deactivation_date: string;
  deactivation_reason_code: string;
  reactivation_date: string;
  created_epoch: string;
  last_updated_epoch: string;
}

interface RawAddress {
  purpose: string;
  address_type: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  country_name: string;
  telephone_number: string;
  fax_number: string;
}

// ── Decoders ───────────────────────────────────────────────────────────────

/**
 * Decode the NPPES status code.
 *
 * Deliberately never returns the bare word "Verified" — status here means
 * "this NPI is active in the registry", which says nothing about whether the
 * provider is licensed, enrolled, or fit to practise.
 */
function decodeStatus(reading: NppesReading): RecordStatus {
  const code = (reading.status ?? '').trim().toUpperCase();
  const label =
    code === 'A' ? 'Active in NPPES'
    : code === 'D' ? 'Deactivated in NPPES'
    : code === 'O' ? 'Other'
    : code ? `Unrecognised status code (${code})`
    : 'Not reported';

  return {
    code,
    label,
    isActive: code === 'A',
    deactivationDate: reading.deactivation_date ?? '',
    deactivationReasonCode: reading.deactivation_reason_code ?? '',
    reactivationDate: reading.reactivation_date ?? '',
  };
}

/** CMS administrative sex code — registry metadata, labelled as such by the UI. */
function decodeSex(code: string): string {
  const c = (code ?? '').trim().toUpperCase();
  if (c === 'M') return 'Male';
  if (c === 'F') return 'Female';
  return '';
}

/**
 * Render a 9-digit NPPES postal code as ZIP+4.
 *
 * CMS stores "926181908"; a reader expects "92618-1908". Anything that is not
 * exactly 9 digits is passed through untouched rather than force-fit, since
 * foreign postal codes and 5-digit ZIPs are both legitimate.
 */
function formatPostalCode(raw: string): string {
  const value = (raw ?? '').trim();
  return /^\d{9}$/.test(value) ? `${value.slice(0, 5)}-${value.slice(5)}` : value;
}

function toRecordAddress(raw: RawAddress | null, purposeOverride?: string): RecordAddress | null {
  if (!raw) return null;
  return {
    purpose: purposeOverride ?? raw.purpose ?? '',
    addressType: raw.address_type ?? '',
    line1: raw.address_1 ?? '',
    line2: raw.address_2 ?? '',
    city: raw.city ?? '',
    state: raw.state ?? '',
    postalCode: raw.postal_code ?? '',
    postalCodeFormatted: formatPostalCode(raw.postal_code ?? ''),
    countryCode: raw.country_code ?? '',
    countryName: raw.country_name ?? '',
    telephone: raw.telephone_number ?? '',
    fax: raw.fax_number ?? '',
  };
}

// ── Provenance and freshness ───────────────────────────────────────────────

function provenanceFor(
  source: SourceDescriptor,
  observedAt: string | null,
  retrievedAt: string | null,
): FieldProvenance {
  return {
    source,
    confirmation: source.maxConfirmation,
    observedAt,
    retrievedAt,
  };
}

/**
 * Compute freshness against the source's own refresh window.
 *
 * `buildCanonicalSourceCoverageFreshness` is a FORMATTER, not an evaluator:
 * it derives `expiresAt` but reports whatever `state` the caller passes in, so
 * handing it a hardcoded 'checked' would mark every record current forever
 * regardless of age. The staleness decision is therefore made here and fed in.
 *
 * The window comes from the source descriptor (mirrored from the backend
 * catalog's refreshSlaHours), so "stale" means the same thing here as it does
 * on every other surface.
 */
function freshnessFor(
  source: SourceDescriptor,
  observedAt: string | null,
  retrievedAt: string | null,
  now: Date,
): RecordFreshness {
  const basis = observedAt ?? retrievedAt;
  const basisMs = basis && !Number.isNaN(Date.parse(basis)) ? Date.parse(basis) : null;

  const expiresMs =
    basisMs !== null ? basisMs + source.freshnessWindowHours * 3_600_000 : null;

  // No usable date means unknown — never assume current.
  const state: 'checked' | 'stale' | 'unknown' =
    basisMs === null ? 'unknown'
    : expiresMs !== null && now.getTime() > expiresMs ? 'stale'
    : 'checked';

  const canonical = buildCanonicalSourceCoverageFreshness({
    state,
    checkedAt: retrievedAt,
    observedAt,
    freshnessWindowHours: source.freshnessWindowHours,
  });

  const ageDays =
    basisMs !== null ? Math.floor((now.getTime() - basisMs) / 86_400_000) : null;

  return {
    status: canonical.status,
    // Deliberately NOT canonical.observedAt: the canonical helper falls back
    // to checkedAt when the source gave no date, which would present "when we
    // read NPPES" as "when CMS last confirmed this". Those are different
    // claims, and conflating them is how a stale record reads as fresh.
    observedAt,
    retrievedAt,
    expiresAt: canonical.expiresAt,
    freshnessWindowHours: canonical.freshnessWindowHours,
    ageDays,
  };
}

// ── Gap detection ──────────────────────────────────────────────────────────

/**
 * State what this record cannot tell a reader.
 *
 * A profile that renders only the fields it happens to have looks complete.
 * For a credentialing reviewer that is the most dangerous possible reading, so
 * absent coverage is first-class content rather than whitespace.
 */
function detectGaps(reading: NppesReading, taxonomyCount: number): RecordGap[] {
  const gaps: RecordGap[] = [];

  gaps.push({
    label: 'Licence status',
    reason:
      'NPPES carries licence numbers as filed but no status for them. Whether a licence is current, expired or disciplined requires a state board check, which is not wired into this record.',
    fillable: true,
  });

  gaps.push({
    label: 'Exclusion and sanction screening',
    reason:
      'No OIG exclusion or federal debarment reading is attached to this record.',
    fillable: true,
  });

  gaps.push({
    label: 'Medicare enrollment',
    reason:
      'Medicare specialty codes shown here are a mapping of the provider’s taxonomy, not evidence of enrollment. PECOS enrollment status is not attached.',
    fillable: true,
  });

  gaps.push({
    label: 'Board certification',
    reason:
      'Credential text is self-reported to CMS. No certifying-board reading is attached.',
    fillable: true,
  });

  if (taxonomyCount === 0) {
    gaps.push({
      label: 'Specialty',
      reason: 'This NPPES record lists no taxonomy, so no specialty can be shown.',
      fillable: false,
    });
  }

  if (!reading.practice_address) {
    gaps.push({
      label: 'Practice location',
      reason: 'This NPPES record lists no practice address.',
      fillable: false,
    });
  }

  return gaps;
}

// ── Builder ────────────────────────────────────────────────────────────────

export interface BuildOptions {
  /** ISO timestamp of when NPPES was read. */
  retrievedAt: string;
  /** Injectable clock for age computation; defaults to now. */
  now?: Date;
}

export function buildClinicianRecord(
  reading: NppesReading,
  options: BuildOptions,
): ClinicianRecord {
  const now = options.now ?? new Date();
  const retrievedAt = options.retrievedAt;

  // NPPES `last_updated` is the closest thing to "when the source last said
  // this was true" — it is the date the provider last changed the record.
  const observedAt = reading.last_updated
    ? new Date(`${reading.last_updated}T00:00:00Z`).toISOString()
    : null;

  const nppesProvenance = provenanceFor(NPPES_SOURCE, observedAt, retrievedAt);
  const nppesFreshness = freshnessFor(NPPES_SOURCE, observedAt, retrievedAt, now);

  const section = <T,>(data: T): RecordSection<T> => ({
    data,
    provenance: nppesProvenance,
    freshness: nppesFreshness,
  });

  const isOrg = (reading.enumeration_type ?? '').toUpperCase() === 'NPI-2';
  const taxonomies = describeTaxonomies(reading.taxonomies ?? []);

  return {
    npi: reading.npi,
    entityType: isOrg ? 'organization' : 'individual',
    entityTypeLabel: isOrg ? 'Organization (Type 2)' : 'Individual (Type 1)',

    status: section(decodeStatus(reading)),

    identity: section({
      displayName: reading.display_name ?? '',
      firstName: reading.first_name ?? '',
      middleName: reading.middle_name ?? '',
      lastName: reading.last_name ?? '',
      namePrefix: reading.name_prefix ?? '',
      nameSuffix: reading.name_suffix ?? '',
      organizationName: reading.organization_name ?? '',
      credential: decodeCredential(reading.credential),
      sexCode: (reading.sex ?? '').trim().toUpperCase(),
      sexLabel: decodeSex(reading.sex),
      soleProprietor: reading.sole_proprietor ?? '',
    }),

    practiceAddress: section(toRecordAddress(reading.practice_address)),
    mailingAddress: section(toRecordAddress(reading.mailing_address)),
    secondaryLocations: section(
      (reading.practice_locations ?? [])
        .map((a) => toRecordAddress(a, 'SECONDARY'))
        .filter((a): a is RecordAddress => a !== null),
    ),

    taxonomies: section(taxonomies),
    selfReportedLicenseStates: section(selfReportedLicenseStates(taxonomies)),

    identifiers: section(
      (reading.identifiers ?? []).map((i) => ({
        code: i.code ?? '',
        description: i.desc ?? '',
        issuer: i.issuer ?? '',
        identifier: i.identifier ?? '',
        state: i.state ?? '',
      })),
    ),

    otherNames: section(
      (reading.other_names ?? []).map((n) => ({
        displayName: n.display_name,
        type: n.type,
      })),
    ),

    endpoints: section(
      (reading.endpoints ?? []).map((e) => ({
        endpoint: e.endpoint,
        endpointType: e.endpointType,
        endpointTypeDescription: e.endpointTypeDescription,
        affiliation: e.affiliation,
      })),
    ),

    authorizedOfficial: section(
      reading.authorized_official
        ? {
            displayName: reading.authorized_official.display_name,
            titleOrPosition: reading.authorized_official.title_or_position,
            telephone: reading.authorized_official.telephone_number,
            credential: reading.authorized_official.credential,
          }
        : null,
    ),
    organizationalSubpart: reading.organizational_subpart ?? '',
    parentOrganizationName: reading.parent_organization_legal_business_name ?? '',

    audit: section({
      enumerationDate: reading.enumeration_date ?? '',
      lastUpdated: reading.last_updated ?? '',
      certificationDate: reading.certification_date ?? '',
      createdEpoch: reading.created_epoch ?? '',
      lastUpdatedEpoch: reading.last_updated_epoch ?? '',
    }),

    gaps: detectGaps(reading, taxonomies.length),

    // Medicare specialty codes are derived, so the derived source is cited
    // whenever any taxonomy resolved to one.
    citedSources: taxonomies.some((t) => t.medicareSpecialties.length > 0)
      ? [NPPES_SOURCE, VITALCV_DERIVED_SOURCE]
      : [NPPES_SOURCE],
  };
}
