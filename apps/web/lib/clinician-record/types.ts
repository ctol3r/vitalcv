/**
 * types.ts — the canonical clinician record.
 *
 * One shape, rendered by every surface that shows a provider: the public
 * verifier view, the signed-in clinician's own view, and the public directory
 * page. Building it once is what stops the three from drifting into three
 * different accounts of the same person.
 *
 * THE CENTRAL RULE
 * ----------------
 * Every value carries its own provenance. A rich, complete-looking profile is
 * exactly the thing that reads as "verified" to a hospital reviewer, so the
 * record makes it impossible to render a value without also having the
 * confirmation level and age that go with it. `Sourced<T>` is the mechanism:
 * there is no way to put a value on this record without saying where it came
 * from.
 */

import type { DescribedTaxonomy } from '@/lib/reference/taxonomy';
import type { DecodedCredential } from '@/lib/reference/credentials';
import type { Confirmation, SourceDescriptor } from './sources';

export type { Confirmation, SourceDescriptor };

export interface FieldProvenance {
  source: SourceDescriptor;
  confirmation: Confirmation;
  /** When the source last said this was true (ISO), null if it never said. */
  observedAt: string | null;
  /** When VitalCV read the source (ISO). */
  retrievedAt: string | null;
}

/** A value that cannot be rendered without its provenance. */
export interface Sourced<T> {
  value: T;
  provenance: FieldProvenance;
}

/** Freshness of a reading, computed against the source's own refresh window. */
export type FreshnessStatus = 'current' | 'stale' | 'unknown';

export interface RecordFreshness {
  status: FreshnessStatus;
  observedAt: string | null;
  retrievedAt: string | null;
  expiresAt: string | null;
  freshnessWindowHours: number | null;
  /** Age of the reading in whole days; the UI phrases it. */
  ageDays: number | null;
}

export interface RecordAddress {
  /** LOCATION | MAILING | SECONDARY */
  purpose: string;
  /** DOM | FGN | MIL */
  addressType: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  /** Raw NPPES postal code, unformatted (e.g. "926181908"). */
  postalCode: string;
  /** ZIP+4 rendering when the raw value supports it (e.g. "92618-1908"). */
  postalCodeFormatted: string;
  countryCode: string;
  countryName: string;
  telephone: string;
  fax: string;
}

export interface RecordIdentifier {
  /** NPPES identifier type code. */
  code: string;
  /** Human description, e.g. "MEDICAID". */
  description: string;
  issuer: string;
  identifier: string;
  state: string;
}

export interface RecordOtherName {
  displayName: string;
  type: string;
}

export interface RecordEndpoint {
  endpoint: string;
  endpointType: string;
  endpointTypeDescription: string;
  affiliation: string;
}

export interface RecordAuthorizedOfficial {
  displayName: string;
  titleOrPosition: string;
  telephone: string;
  credential: string;
}

export interface RecordStatus {
  /** Raw NPPES code: A | D | O */
  code: string;
  /** "Active" | "Deactivated" | ... — decoded, never the bare word Verified. */
  label: string;
  isActive: boolean;
  deactivationDate: string;
  deactivationReasonCode: string;
  reactivationDate: string;
}

export interface RecordIdentity {
  /** Full name as filed, including prefix/suffix and credential. */
  displayName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  namePrefix: string;
  nameSuffix: string;
  organizationName: string;
  /** Raw credential string plus its conservative decode. */
  credential: DecodedCredential;
  /**
   * CMS administrative sex code, decoded to a label. Registry metadata about
   * a filing, not a statement about the person's gender identity — surfaces
   * must label it as the CMS field it is.
   */
  sexCode: string;
  sexLabel: string;
  soleProprietor: string;
}

/**
 * A group of fields that share one provenance, which is how the data actually
 * arrives — a whole NPPES reading is one fetch at one moment, not 40
 * independently-dated facts.
 */
export interface RecordSection<T> {
  data: T;
  provenance: FieldProvenance;
  freshness: RecordFreshness;
}

/** What the record does NOT have, stated explicitly. */
export interface RecordGap {
  /** Field or capability that is absent. */
  label: string;
  /** Why it is absent, in reader-facing terms. */
  reason: string;
  /** True when a wired source could fill it; false when no source exists yet. */
  fillable: boolean;
}

/** Medicare enrollment as CMS publishes it, when the clinician is listed. */
export interface RecordMedicareEnrollment {
  /**
   * 'enrolled' | 'not_listed' | 'unavailable'.
   *
   * `not_listed` is NOT a negative finding — clinicians who do not bill
   * Medicare are legitimately absent — and `unavailable` means we could not
   * ask, which is different again.
   */
  state: 'enrolled' | 'not_listed' | 'unavailable';
  medicalSchool: string;
  graduationYear: string;
  primarySpecialty: string;
  secondarySpecialties: string[];
  /** Distinct group practices, deduplicated across practice addresses. */
  affiliations: Array<{
    facilityName: string;
    organizationPacId: string;
    memberCount: string;
    locations: number;
  }>;
  /** Null when CMS reported no assignment flag either way. */
  acceptsAssignment: boolean | null;
  individualPacId: string;
  individualEnrollmentId: string;
  /**
   * Whether the surname CMS holds matches the NPPES filing. Null when either
   * side has no surname to compare. False is worth a reader's attention.
   */
  surnameAgreesWithNppes: boolean | null;
}

export interface ClinicianRecord {
  npi: string;
  /** NPI-1 => individual, NPI-2 => organization. */
  entityType: 'individual' | 'organization';
  entityTypeLabel: string;

  status: RecordSection<RecordStatus>;
  identity: RecordSection<RecordIdentity>;

  /** Primary practice location as filed with CMS. */
  practiceAddress: RecordSection<RecordAddress | null>;
  mailingAddress: RecordSection<RecordAddress | null>;
  /**
   * Secondary practice sites from the NPPES `practiceLocations` key. Registry
   * mirrors that read only `addresses` miss these entirely.
   */
  secondaryLocations: RecordSection<RecordAddress[]>;

  taxonomies: RecordSection<DescribedTaxonomy[]>;
  /** States the provider reported a licence number under. Not a licence check. */
  selfReportedLicenseStates: RecordSection<string[]>;

  identifiers: RecordSection<RecordIdentifier[]>;
  otherNames: RecordSection<RecordOtherName[]>;
  endpoints: RecordSection<RecordEndpoint[]>;

  /** Type-2 only; null for individuals. */
  authorizedOfficial: RecordSection<RecordAuthorizedOfficial | null>;
  organizationalSubpart: string;
  parentOrganizationName: string;

  audit: RecordSection<{
    enumerationDate: string;
    lastUpdated: string;
    certificationDate: string;
    createdEpoch: string;
    lastUpdatedEpoch: string;
  }>;

  /**
   * Coverage the record does not have. Rendered, not hidden — a profile that
   * shows only what it knows reads as complete, and completeness is precisely
   * the false impression to avoid.
   */
  gaps: RecordGap[];

  /**
   * Medicare enrollment, when the CMS Doctors & Clinicians connector ran.
   * Null when it was never attempted.
   */
  medicareEnrollment: RecordSection<RecordMedicareEnrollment> | null;

  /** Every source cited anywhere on this record, for a provenance footer. */
  citedSources: SourceDescriptor[];
}
