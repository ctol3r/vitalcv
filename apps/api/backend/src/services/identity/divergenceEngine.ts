import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { appendAuditEvent } from '../audit/auditLedger';
import { loadClaimRecordsForNpi } from './identityStore';
import { sha256ForPayload } from '../../utils/deterministic';

export type DivergenceSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type DivergenceResolution = 'OPEN' | 'RESOLVED';

export interface DivergenceConflict {
  id: string;
  ruleId: string;
  claimType: string;
  dimension: 'identity' | 'licensure' | 'enrollment';
  severity: DivergenceSeverity;
  description: string;
  sources: string[];
  values: string[];
  detectedAt: string;
  penalty: number;
  basePenalty: number;
  active: boolean;
  requiresReview: boolean;
  resolution: DivergenceResolution;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface DivergenceReport {
  npi: string;
  computedAt: string;
  conflicts: DivergenceConflict[];
  totalPenalty: number;
  hasBlocking: boolean;
  summary: string;
  rulesFired: string[];
}

export interface DivergenceHistoryEntry {
  conflictId: string;
  ruleId: string | null;
  claimType: string;
  severity: DivergenceSeverity;
  status: 'OPEN' | 'CONFIRMED' | 'RESOLVED' | 'REJECTED';
  description: string;
  sources: string[];
  values: string[];
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  occurrenceCount: number;
  resolutionNote?: string;
}

export interface DivergenceHistoryReport {
  npi: string;
  count: number;
  openCount: number;
  resolvedCount: number;
  history: DivergenceHistoryEntry[];
  computedAt: string;
}

export interface ResolveDivergenceResult {
  npi: string;
  conflictId: string;
  resolution: 'RESOLVED';
  resolvedAt: string;
  auditEventId: string;
  note: string | null;
}

type JsonRecord = Record<string, unknown>;

type IdentityEvidence = {
  sourceId: string;
  observedAt: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  dateOfBirth: string | null;
};

type SpecialtyEvidence = {
  sourceId: string;
  observedAt: string;
  specialty: string | null;
  isPrimary: boolean;
};

type AddressEvidence = {
  sourceId: string;
  observedAt: string;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type EnrollmentEvidence = {
  sourceId: string;
  observedAt: string;
  claimState: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED' | 'OPTED_OUT' | null;
};

type LicenseEvidence = {
  sourceId: string;
  observedAt: string;
  state: string | null;
  licenseNumber: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | 'UNKNOWN' | null;
  issueDate: string | null;
  expiryDate: string | null;
};

type DivergenceConflictDraft = {
  ruleId: string;
  signatureKey: string;
  claimType: string;
  dimension: DivergenceConflict['dimension'];
  severity: DivergenceSeverity;
  description: string;
  sources: string[];
  values: string[];
  detectedAt: string;
  basePenalty: number;
};

type StoredAnomalyRow = {
  anomalyKey: string;
  severity: string;
  status: string;
  occurrenceCount: number;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  resolvedAt: Date | null;
  lastFingerprint: string;
  metadata: unknown;
};

const SOURCE_ALIASES: Record<string, string> = {
  NPPES: 'NPPES_API',
  NPI_REGISTRY: 'NPPES_API',
  PECOS: 'PECOS_PUBLIC',
  OIG: 'OIG_LEIE',
};

const SEVERITY_PENALTIES: Record<DivergenceSeverity, number> = {
  HIGH: 15,
  MEDIUM: 7,
  LOW: 3,
};

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  const stringValue = asString(value);
  if (!stringValue) {
    return null;
  }
  const parsed = Date.parse(stringValue);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeSourceId(value: string): string {
  const normalized = value.trim().toUpperCase();
  return SOURCE_ALIASES[normalized] ?? normalized;
}

function normalizeWhitespace(value: string | null): string | null {
  return value ? value.replace(/\s+/g, ' ').trim() : null;
}

function normalizeComparableText(value: string | null): string | null {
  const normalized = normalizeWhitespace(value);
  return normalized
    ? normalized.toUpperCase().replace(/[^A-Z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()
    : null;
}

function normalizeNamePart(value: string | null): string | null {
  const normalized = normalizeComparableText(value);
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeDateOnly(value: unknown): string | null {
  const iso = asIsoString(value);
  if (iso) {
    return iso.slice(0, 10);
  }

  const stringValue = asString(value);
  if (!stringValue) {
    return null;
  }

  const directMatch = stringValue.match(/\d{4}-\d{2}-\d{2}/);
  return directMatch?.[0] ?? null;
}

function normalizeZip(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D+/g, '');
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

function normalizeEnrollmentState(value: unknown): EnrollmentEvidence['claimState'] {
  const normalized = normalizeComparableText(asString(value));
  switch (normalized) {
    case 'ENROLLED':
    case 'ACTIVE':
    case 'VERIFIED':
      return 'ENROLLED';
    case 'NOT FOUND':
    case 'NOTFOUND':
    case 'NOT ENROLLED':
    case 'INACTIVE':
      return 'NOT_FOUND';
    case 'OPTED OUT':
    case 'OPTEDOUT':
      return 'OPTED_OUT';
    case 'UNCHECKED':
    case 'PENDING':
      return 'UNCHECKED';
    case 'UNKNOWN':
    case 'REVIEW REQUIRED':
      return 'UNKNOWN';
    default:
      return null;
  }
}

function normalizeLicenseStatus(value: unknown): LicenseEvidence['status'] {
  const normalized = normalizeComparableText(asString(value));
  switch (normalized) {
    case 'ACTIVE':
    case 'VERIFIED':
    case 'CURRENT':
      return 'ACTIVE';
    case 'EXPIRED':
    case 'LAPSED':
      return 'EXPIRED';
    case 'SUSPENDED':
      return 'SUSPENDED';
    case 'REVOKED':
    case 'CANCELLED':
      return 'REVOKED';
    case 'UNKNOWN':
    case 'NOT FOUND':
    case 'NOTFOUND':
      return 'UNKNOWN';
    default:
      return null;
  }
}

function pickPayload(rawPayload: unknown): JsonRecord {
  const payload = asRecord(rawPayload);
  const nested = asRecord(payload.payload_json);
  return Object.keys(nested).length > 0 ? nested : payload;
}

function compareIso(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}

function keepLatest<T extends { observedAt: string }>(current: T | undefined, next: T): T {
  if (!current) {
    return next;
  }

  return compareIso(current.observedAt, next.observedAt) <= 0 ? next : current;
}

function stableId(ruleId: string, npi: string, signatureKey: string): string {
  return `div_${sha256ForPayload({ ruleId, npi, signatureKey }).slice(0, 16)}`;
}

function divergenceFingerprint(input: {
  ruleId: string;
  sources: string[];
  values: string[];
}): string {
  return sha256ForPayload({
    ruleId: input.ruleId,
    sources: [...input.sources].sort(),
    values: [...input.values].sort(),
  });
}

function severityPenalty(severity: DivergenceSeverity): number {
  return SEVERITY_PENALTIES[severity];
}

function confidenceForSeverity(severity: DivergenceSeverity): number {
  if (severity === 'HIGH') return 0.95;
  if (severity === 'MEDIUM') return 0.82;
  return 0.7;
}

function isDivergenceAnomaly(row: StoredAnomalyRow): boolean {
  const metadata = asRecord(row.metadata);
  return row.anomalyKey.startsWith('div_')
    || asString(metadata.kind) === 'TRUST_DIVERGENCE';
}

function resolutionNote(metadata: unknown): string | undefined {
  const record = asRecord(metadata);
  return asString(record.resolutionNote) ?? undefined;
}

function ruleIdFromMetadata(metadata: unknown): string | null {
  const record = asRecord(metadata);
  return asString(record.ruleId);
}

function descriptionFromMetadata(metadata: unknown): string {
  const record = asRecord(metadata);
  return asString(record.description) ?? 'Cross-source divergence recorded.';
}

function valuesFromMetadata(metadata: unknown): string[] {
  const record = asRecord(metadata);
  const values = record.values;
  return Array.isArray(values)
    ? values.map((value) => asString(value)).filter((value): value is string => Boolean(value))
    : [];
}

function sourcesFromMetadata(metadata: unknown): string[] {
  const record = asRecord(metadata);
  const values = record.sources;
  return Array.isArray(values)
    ? values.map((value) => asString(value)).filter((value): value is string => Boolean(value))
    : [];
}

function collectEvidence(claims: Awaited<ReturnType<typeof loadClaimRecordsForNpi>>, artifacts: Array<{
  source: string;
  status: string;
  rawPayload: unknown;
  verifiedAt: Date;
  observedAt: Date | null;
}>): {
  identity: IdentityEvidence[];
  specialties: SpecialtyEvidence[];
  addresses: AddressEvidence[];
  enrollments: EnrollmentEvidence[];
  licenses: LicenseEvidence[];
} {
  const identityBySource = new Map<string, IdentityEvidence>();
  const specialtyBySource = new Map<string, SpecialtyEvidence>();
  const addressBySource = new Map<string, AddressEvidence>();
  const enrollmentBySource = new Map<string, EnrollmentEvidence>();
  const licenseByKey = new Map<string, LicenseEvidence>();

  for (const claim of claims) {
    const sourceId = normalizeSourceId(claim.sourceId);
    const value = asRecord(claim.value);
    const observedAt = claim.observedAt;

    if (claim.claimType === 'PERSONAL_IDENTITY') {
      const next: IdentityEvidence = {
        sourceId,
        observedAt,
        firstName: asString(value.firstName),
        lastName: asString(value.lastName),
        middleName: asString(value.middleName),
        dateOfBirth:
          normalizeDateOnly(value.dateOfBirth)
          ?? normalizeDateOnly(value.birthDate)
          ?? normalizeDateOnly(value.dob),
      };
      identityBySource.set(sourceId, keepLatest(identityBySource.get(sourceId), next));
      continue;
    }

    if (claim.claimType === 'SPECIALTY') {
      const next: SpecialtyEvidence = {
        sourceId,
        observedAt,
        specialty:
          asString(value.taxonomyDescription)
          ?? asString(value.specialty)
          ?? asString(value.label),
        isPrimary: asBoolean(value.isPrimary) === true,
      };
      const current = specialtyBySource.get(sourceId);
      if (!current || (next.isPrimary && !current.isPrimary) || compareIso(current.observedAt, next.observedAt) <= 0) {
        specialtyBySource.set(sourceId, next);
      }
      continue;
    }

    if (claim.claimType === 'PRACTICE_LOCATION') {
      const next: AddressEvidence = {
        sourceId,
        observedAt,
        address1: asString(value.address1),
        city: asString(value.city),
        state: asString(value.state)?.toUpperCase() ?? null,
        zip: normalizeZip(asString(value.zip)),
      };
      addressBySource.set(sourceId, keepLatest(addressBySource.get(sourceId), next));
      continue;
    }

    if (claim.claimType === 'ENROLLMENT_STATUS') {
      const next: EnrollmentEvidence = {
        sourceId,
        observedAt,
        claimState:
          normalizeEnrollmentState(value.claimState)
          ?? normalizeEnrollmentState(value.label)
          ?? (asBoolean(value.enrolled) === true ? 'ENROLLED' : null),
      };
      enrollmentBySource.set(sourceId, keepLatest(enrollmentBySource.get(sourceId), next));
      continue;
    }

    if (claim.claimType === 'LICENSE' || claim.claimType === 'NURSING_LICENSE') {
      const state = asString(value.state)?.toUpperCase() ?? null;
      const licenseNumber = asString(value.licenseNumber);
      const next: LicenseEvidence = {
        sourceId,
        observedAt,
        state,
        licenseNumber,
        status: normalizeLicenseStatus(value.licenseStatus),
        issueDate: normalizeDateOnly(value.issueDate),
        expiryDate: normalizeDateOnly(value.expiryDate),
      };
      const key = `${sourceId}:${state ?? 'NA'}:${licenseNumber ?? 'NA'}`;
      licenseByKey.set(key, keepLatest(licenseByKey.get(key), next));
    }
  }

  for (const artifact of artifacts) {
    const sourceId = normalizeSourceId(artifact.source);
    const payload = pickPayload(artifact.rawPayload);
    const basic = asRecord(payload.basic);
    const observedAt = artifact.observedAt?.toISOString() ?? artifact.verifiedAt.toISOString();

    const identityCandidate: IdentityEvidence = {
      sourceId,
      observedAt,
      firstName:
        asString(payload.firstName)
        ?? asString(payload.first_name)
        ?? asString(basic.first_name),
      lastName:
        asString(payload.lastName)
        ?? asString(payload.last_name)
        ?? asString(basic.last_name),
      middleName:
        asString(payload.middleName)
        ?? asString(payload.middle_name)
        ?? asString(basic.middle_name),
      dateOfBirth:
        normalizeDateOnly(payload.dateOfBirth)
        ?? normalizeDateOnly(payload.birthDate)
        ?? normalizeDateOnly(payload.dob),
    };
    if (identityCandidate.firstName || identityCandidate.lastName || identityCandidate.dateOfBirth) {
      identityBySource.set(sourceId, keepLatest(identityBySource.get(sourceId), identityCandidate));
    }

    const specialtyCandidate: SpecialtyEvidence = {
      sourceId,
      observedAt,
      specialty:
        asString(payload.specialty)
        ?? asString(payload.primarySpecialty)
        ?? asString(payload.taxonomyDescription)
        ?? asString(payload.taxonomy_description)
        ?? asString(payload.provider_type),
      isPrimary: true,
    };
    if (specialtyCandidate.specialty) {
      const current = specialtyBySource.get(sourceId);
      if (!current || compareIso(current.observedAt, specialtyCandidate.observedAt) <= 0) {
        specialtyBySource.set(sourceId, specialtyCandidate);
      }
    }

    const addressCandidate: AddressEvidence = {
      sourceId,
      observedAt,
      address1:
        asString(payload.address1)
        ?? asString(payload.practiceAddress1)
        ?? asString(payload.practice_address_1)
        ?? asString(payload.line1),
      city:
        asString(payload.city)
        ?? asString(payload.practiceCity)
        ?? asString(payload.practice_city),
      state:
        asString(payload.state)
        ?? asString(payload.practiceState)
        ?? asString(payload.practice_state),
      zip:
        normalizeZip(
          asString(payload.zip)
          ?? asString(payload.practiceZip)
          ?? asString(payload.practice_zip),
        ),
    };
    if (addressCandidate.city || addressCandidate.state || addressCandidate.zip) {
      addressBySource.set(sourceId, keepLatest(addressBySource.get(sourceId), {
        ...addressCandidate,
        state: addressCandidate.state?.toUpperCase() ?? null,
      }));
    }

    const enrollmentCandidate: EnrollmentEvidence = {
      sourceId,
      observedAt,
      claimState:
        normalizeEnrollmentState(payload.claimState)
        ?? normalizeEnrollmentState(payload.enrollmentStatus)
        ?? normalizeEnrollmentState(payload.status)
        ?? (sourceId === 'PECOS_PUBLIC' ? normalizeEnrollmentState(artifact.status) : null),
    };
    if (enrollmentCandidate.claimState) {
      enrollmentBySource.set(sourceId, keepLatest(enrollmentBySource.get(sourceId), enrollmentCandidate));
    }

    const licenseCandidate: LicenseEvidence = {
      sourceId,
      observedAt,
      state:
        asString(payload.state)?.toUpperCase()
        ?? asString(payload.jurisdiction)?.toUpperCase()
        ?? null,
      licenseNumber: asString(payload.licenseNumber) ?? asString(payload.license_number),
      status:
        normalizeLicenseStatus(payload.licenseStatus)
        ?? normalizeLicenseStatus(payload.license_status)
        ?? ((sourceId === 'STATE_BOARD' || sourceId === 'NURSYS') ? normalizeLicenseStatus(artifact.status) : null),
      issueDate: normalizeDateOnly(payload.issueDate) ?? normalizeDateOnly(payload.issue_date),
      expiryDate:
        normalizeDateOnly(payload.expirationDate)
        ?? normalizeDateOnly(payload.expiration_date)
        ?? normalizeDateOnly(payload.expiryDate),
    };
    if (licenseCandidate.state || licenseCandidate.licenseNumber || licenseCandidate.status) {
      const key = `${sourceId}:${licenseCandidate.state ?? 'NA'}:${licenseCandidate.licenseNumber ?? 'NA'}`;
      licenseByKey.set(key, keepLatest(licenseByKey.get(key), licenseCandidate));
    }
  }

  return {
    identity: [...identityBySource.values()],
    specialties: [...specialtyBySource.values()],
    addresses: [...addressBySource.values()],
    enrollments: [...enrollmentBySource.values()],
    licenses: [...licenseByKey.values()],
  };
}

function nameDisplay(value: IdentityEvidence): string {
  return [value.firstName, value.middleName, value.lastName]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .trim();
}

function namesEquivalent(left: IdentityEvidence, right: IdentityEvidence): boolean {
  return normalizeNamePart(left.firstName) === normalizeNamePart(right.firstName)
    && normalizeNamePart(left.lastName) === normalizeNamePart(right.lastName);
}

function specialtiesEquivalent(left: string, right: string): boolean {
  const leftNormalized = normalizeComparableText(left);
  const rightNormalized = normalizeComparableText(right);

  if (!leftNormalized || !rightNormalized) {
    return true;
  }

  if (leftNormalized === rightNormalized) {
    return true;
  }

  const leftHead = leftNormalized.split(' ').slice(0, 2).join(' ');
  const rightHead = rightNormalized.split(' ').slice(0, 2).join(' ');
  return leftHead === rightHead;
}

function addressFingerprint(value: AddressEvidence): string | null {
  const city = normalizeComparableText(value.city);
  const state = normalizeComparableText(value.state);
  const zip = normalizeZip(value.zip);
  const line = normalizeComparableText(value.address1);

  if (!city && !state && !zip && !line) {
    return null;
  }

  return [line, city, state, zip].filter(Boolean).join('|');
}

function detectedAt(...values: string[]): string {
  const timestamps = values
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function buildDraft(input: Omit<DivergenceConflictDraft, 'basePenalty'> & { severity: DivergenceSeverity }): DivergenceConflictDraft {
  return {
    ...input,
    basePenalty: severityPenalty(input.severity),
  };
}

function detectNameMismatch(npi: string, identityEvidence: IdentityEvidence[]): DivergenceConflictDraft[] {
  const populated = identityEvidence.filter((entry) => entry.firstName && entry.lastName);
  if (populated.length < 2) {
    return [];
  }

  const primary = populated.find((entry) => entry.sourceId === 'NPPES_API') ?? populated[0]!;
  const mismatched = populated.filter((entry) => !namesEquivalent(primary, entry));
  if (mismatched.length === 0) {
    return [];
  }

  const sources = [primary, ...mismatched].map((entry) => entry.sourceId);
  const values = [primary, ...mismatched].map((entry) => `${entry.sourceId}: ${nameDisplay(entry)}`);

  return [buildDraft({
    ruleId: 'NAME_MISMATCH',
    signatureKey: `name:${sources.sort().join('|')}`,
    claimType: 'PERSONAL_IDENTITY',
    dimension: 'identity',
    severity: 'HIGH',
    description: `Authoritative sources disagree on provider name for NPI ${npi}.`,
    sources,
    values,
    detectedAt: detectedAt(primary.observedAt, ...mismatched.map((entry) => entry.observedAt)),
  })];
}

function detectDobConflict(identityEvidence: IdentityEvidence[]): DivergenceConflictDraft[] {
  const withDob = identityEvidence.filter((entry) => entry.dateOfBirth);
  if (withDob.length < 2) {
    return [];
  }

  const distinctDobs = [...new Set(withDob.map((entry) => entry.dateOfBirth).filter((value): value is string => Boolean(value)))];
  if (distinctDobs.length < 2) {
    return [];
  }

  return [buildDraft({
    ruleId: 'DOB_CONFLICT',
    signatureKey: `dob:${distinctDobs.sort().join('|')}`,
    claimType: 'PERSONAL_IDENTITY',
    dimension: 'identity',
    severity: 'HIGH',
    description: 'Date of birth differs across source-backed identity records.',
    sources: withDob.map((entry) => entry.sourceId),
    values: withDob.map((entry) => `${entry.sourceId}: ${entry.dateOfBirth}`),
    detectedAt: detectedAt(...withDob.map((entry) => entry.observedAt)),
  })];
}

function detectLicenseStatusDiscrepancy(licenses: LicenseEvidence[]): DivergenceConflictDraft[] {
  const byLicense = new Map<string, LicenseEvidence[]>();
  for (const license of licenses) {
    if (!license.state || !license.status) {
      continue;
    }

    const key = `${license.state}:${license.licenseNumber ?? 'UNKNOWN'}`;
    const bucket = byLicense.get(key) ?? [];
    bucket.push(license);
    byLicense.set(key, bucket);
  }

  const drafts: DivergenceConflictDraft[] = [];
  for (const [key, bucket] of byLicense.entries()) {
    const nonUnknown = bucket.filter((entry) => entry.status && entry.status !== 'UNKNOWN');
    const distinct = [...new Set(nonUnknown.map((entry) => entry.status))];
    if (distinct.length < 2) {
      continue;
    }

    const hasActive = distinct.includes('ACTIVE');
    const hasAdverse = distinct.some((status) => status === 'EXPIRED' || status === 'SUSPENDED' || status === 'REVOKED');
    if (!hasActive || !hasAdverse) {
      continue;
    }

    drafts.push(buildDraft({
      ruleId: 'LICENSE_STATUS_DISCREPANCY',
      signatureKey: `license-status:${key}:${distinct.sort().join('|')}`,
      claimType: 'LICENSE',
      dimension: 'licensure',
      severity: 'HIGH',
      description: `Licensure status for ${key} conflicts across sources.`,
      sources: bucket.map((entry) => entry.sourceId),
      values: bucket.map((entry) => `${entry.sourceId}: ${entry.status}`),
      detectedAt: detectedAt(...bucket.map((entry) => entry.observedAt)),
    }));
  }

  return drafts;
}

function detectSpecialtyMismatch(specialties: SpecialtyEvidence[]): DivergenceConflictDraft[] {
  const populated = specialties.filter((entry) => entry.specialty);
  if (populated.length < 2) {
    return [];
  }

  const canonical = populated.find((entry) => entry.sourceId === 'NPPES_API') ?? populated[0]!;
  const mismatched = populated.filter((entry) => entry.specialty && canonical.specialty && !specialtiesEquivalent(canonical.specialty, entry.specialty));
  if (mismatched.length === 0) {
    return [];
  }

  return [buildDraft({
    ruleId: 'SPECIALTY_MISMATCH',
    signatureKey: `specialty:${mismatched.map((entry) => normalizeComparableText(entry.specialty)).join('|')}`,
    claimType: 'SPECIALTY',
    dimension: 'identity',
    severity: 'LOW',
    description: 'Primary specialty differs across source-backed records.',
    sources: [canonical, ...mismatched].map((entry) => entry.sourceId),
    values: [canonical, ...mismatched].map((entry) => `${entry.sourceId}: ${entry.specialty}`),
    detectedAt: detectedAt(canonical.observedAt, ...mismatched.map((entry) => entry.observedAt)),
  })];
}

function detectEnrollmentContradiction(enrollments: EnrollmentEvidence[]): DivergenceConflictDraft[] {
  const actionable = enrollments.filter((entry) => entry.claimState && entry.claimState !== 'UNKNOWN' && entry.claimState !== 'UNCHECKED');
  if (actionable.length < 2) {
    return [];
  }

  const distinct = [...new Set(actionable.map((entry) => entry.claimState))];
  const contradicts =
    distinct.includes('ENROLLED')
    && (distinct.includes('NOT_FOUND') || distinct.includes('OPTED_OUT'));

  if (!contradicts) {
    return [];
  }

  return [buildDraft({
    ruleId: 'ENROLLMENT_CONTRADICTION',
    signatureKey: `enrollment:${distinct.sort().join('|')}`,
    claimType: 'ENROLLMENT_STATUS',
    dimension: 'enrollment',
    severity: 'MEDIUM',
    description: 'Enrollment sources disagree on current Medicare participation status.',
    sources: actionable.map((entry) => entry.sourceId),
    values: actionable.map((entry) => `${entry.sourceId}: ${entry.claimState}`),
    detectedAt: detectedAt(...actionable.map((entry) => entry.observedAt)),
  })];
}

function detectAddressDivergence(addresses: AddressEvidence[]): DivergenceConflictDraft[] {
  const populated = addresses.filter((entry) => addressFingerprint(entry));
  if (populated.length < 2) {
    return [];
  }

  const primary = populated.find((entry) => entry.sourceId === 'NPPES_API') ?? populated[0]!;
  const primaryFingerprint = addressFingerprint(primary);
  if (!primaryFingerprint) {
    return [];
  }

  const mismatched = populated.filter((entry) => {
    const fingerprint = addressFingerprint(entry);
    return fingerprint && fingerprint !== primaryFingerprint;
  });
  if (mismatched.length === 0) {
    return [];
  }

  return [buildDraft({
    ruleId: 'ADDRESS_DIVERGENCE',
    signatureKey: `address:${[primary, ...mismatched].map((entry) => addressFingerprint(entry)).join('|')}`,
    claimType: 'PRACTICE_LOCATION',
    dimension: 'identity',
    severity: 'LOW',
    description: 'Practice location differs across source-backed records.',
    sources: [primary, ...mismatched].map((entry) => entry.sourceId),
    values: [primary, ...mismatched].map((entry) => {
      const parts = [entry.address1, entry.city, entry.state, entry.zip].filter((part): part is string => Boolean(part));
      return `${entry.sourceId}: ${parts.join(', ')}`;
    }),
    detectedAt: detectedAt(primary.observedAt, ...mismatched.map((entry) => entry.observedAt)),
  })];
}

function detectCredentialDateConflicts(licenses: LicenseEvidence[]): DivergenceConflictDraft[] {
  const byLicense = new Map<string, LicenseEvidence[]>();
  for (const license of licenses) {
    if (!license.state) {
      continue;
    }

    const key = `${license.state}:${license.licenseNumber ?? 'UNKNOWN'}`;
    const bucket = byLicense.get(key) ?? [];
    bucket.push(license);
    byLicense.set(key, bucket);
  }

  const drafts: DivergenceConflictDraft[] = [];
  for (const [key, bucket] of byLicense.entries()) {
    if (bucket.length < 2) {
      continue;
    }

    const distinctIssueDates = [...new Set(bucket.map((entry) => entry.issueDate).filter((value): value is string => Boolean(value)))];
    const distinctExpiryDates = [...new Set(bucket.map((entry) => entry.expiryDate).filter((value): value is string => Boolean(value)))];
    if (distinctIssueDates.length < 2 && distinctExpiryDates.length < 2) {
      continue;
    }

    drafts.push(buildDraft({
      ruleId: 'CREDENTIAL_DATE_CONFLICT',
      signatureKey: `license-dates:${key}:${distinctIssueDates.sort().join('|')}:${distinctExpiryDates.sort().join('|')}`,
      claimType: 'LICENSE',
      dimension: 'licensure',
      severity: 'MEDIUM',
      description: `License issue or expiry dates for ${key} differ across sources.`,
      sources: bucket.map((entry) => entry.sourceId),
      values: bucket.map((entry) => `${entry.sourceId}: issue=${entry.issueDate ?? 'unknown'}, expiry=${entry.expiryDate ?? 'unknown'}`),
      detectedAt: detectedAt(...bucket.map((entry) => entry.observedAt)),
    }));
  }

  return drafts;
}

function applyStoredResolution(
  npi: string,
  draft: DivergenceConflictDraft,
  stored: StoredAnomalyRow | undefined,
): DivergenceConflict {
  const id = stableId(draft.ruleId, npi, draft.signatureKey);
  const fingerprint = divergenceFingerprint({
    ruleId: draft.ruleId,
    sources: draft.sources,
    values: draft.values,
  });
  const metadata = stored ? asRecord(stored.metadata) : {};
  const isResolved = stored?.status === 'RESOLVED' && stored.lastFingerprint === fingerprint;

  return {
    id,
    ruleId: draft.ruleId,
    claimType: draft.claimType,
    dimension: draft.dimension,
    severity: draft.severity,
    description: draft.description,
    sources: draft.sources,
    values: draft.values,
    detectedAt: stored?.firstDetectedAt?.toISOString() ?? draft.detectedAt,
    penalty: isResolved ? 0 : draft.basePenalty,
    basePenalty: draft.basePenalty,
    active: !isResolved,
    requiresReview: draft.severity !== 'LOW',
    resolution: isResolved ? 'RESOLVED' : 'OPEN',
    resolvedAt: isResolved ? stored?.resolvedAt?.toISOString() ?? undefined : undefined,
    resolutionNote: resolutionNote(metadata),
  };
}

async function loadStoredDivergences(npi: string): Promise<Map<string, StoredAnomalyRow>> {
  const rows = await prisma.anomalyHistory.findMany({
    where: {
      subjectType: 'NPI',
      subjectId: npi,
    },
    select: {
      anomalyKey: true,
      severity: true,
      status: true,
      occurrenceCount: true,
      firstDetectedAt: true,
      lastDetectedAt: true,
      resolvedAt: true,
      lastFingerprint: true,
      metadata: true,
    },
  });

  return new Map(
    rows
      .filter(isDivergenceAnomaly)
      .map((row) => [row.anomalyKey, row]),
  );
}

export async function detectDivergence(npi: string): Promise<DivergenceReport> {
  const [claims, artifacts, stored] = await Promise.all([
    loadClaimRecordsForNpi(npi),
    prisma.verificationArtifact.findMany({
      where: {
        npi,
        status: { not: 'REVOKED' },
      },
      orderBy: [
        { observedAt: 'desc' },
        { verifiedAt: 'desc' },
      ],
      select: {
        source: true,
        status: true,
        rawPayload: true,
        verifiedAt: true,
        observedAt: true,
      },
    }),
    loadStoredDivergences(npi),
  ]);

  const evidence = collectEvidence(claims, artifacts);
  const drafts = [
    ...detectNameMismatch(npi, evidence.identity),
    ...detectDobConflict(evidence.identity),
    ...detectLicenseStatusDiscrepancy(evidence.licenses),
    ...detectSpecialtyMismatch(evidence.specialties),
    ...detectEnrollmentContradiction(evidence.enrollments),
    ...detectAddressDivergence(evidence.addresses),
    ...detectCredentialDateConflicts(evidence.licenses),
  ];

  const conflicts = drafts
    .map((draft) => {
      const id = stableId(draft.ruleId, npi, draft.signatureKey);
      return applyStoredResolution(npi, draft, stored.get(id));
    })
    .sort((left, right) => {
      const severityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
      return severityRank[left.severity] - severityRank[right.severity]
        || Date.parse(right.detectedAt) - Date.parse(left.detectedAt);
    });

  const totalPenalty = conflicts.reduce((sum, conflict) => sum + conflict.penalty, 0);
  const hasBlocking = conflicts.some((conflict) => conflict.active && conflict.severity === 'HIGH');
  const rulesFired = [...new Set(conflicts.map((conflict) => conflict.ruleId))];

  if (hasBlocking) {
    for (const conflict of conflicts.filter((entry) => entry.active && entry.severity === 'HIGH')) {
      try {
        appendAuditEvent({
          category: 'VERIFICATION',
          actor: 'divergence-engine',
          resource: `npi:${npi}`,
          severity: 'CRITICAL',
          resultFields: {
            conflictId: conflict.id,
            ruleId: conflict.ruleId,
            severity: conflict.severity,
            penalty: conflict.penalty,
            sources: conflict.sources,
          },
        });
      } catch {
        // Ignore in-memory audit failures for computed read paths.
      }
    }
  }

  const activeCount = conflicts.filter((conflict) => conflict.active).length;
  const resolvedCount = conflicts.length - activeCount;
  const summary = conflicts.length === 0
    ? 'No cross-source divergences detected.'
    : `${activeCount} active divergence${activeCount === 1 ? '' : 's'}${resolvedCount > 0 ? `, ${resolvedCount} resolved` : ''}. Active CRS penalty: -${totalPenalty}.`;

  log('info', 'divergence_engine_computed', {
    npi,
    conflictCount: conflicts.length,
    activeCount,
    resolvedCount,
    totalPenalty,
    hasBlocking,
  });

  return {
    npi,
    computedAt: new Date().toISOString(),
    conflicts,
    totalPenalty,
    hasBlocking,
    summary,
    rulesFired,
  };
}

export async function batchDivergenceScan(
  npis: string[],
): Promise<Array<{ npi: string; conflicts: number; hasBlocking: boolean }>> {
  const results = await Promise.allSettled(npis.map((npi) => detectDivergence(npi)));
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        npi: result.value.npi,
        conflicts: result.value.conflicts.filter((conflict) => conflict.active).length,
        hasBlocking: result.value.hasBlocking,
      };
    }

    log('warn', 'divergence_batch_scan_failed', {
      npi: npis[index],
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });

    return {
      npi: npis[index] ?? 'unknown',
      conflicts: -1,
      hasBlocking: false,
    };
  });
}

export async function listDivergenceHistory(npi: string): Promise<DivergenceHistoryReport> {
  const rows = await prisma.anomalyHistory.findMany({
    where: {
      subjectType: 'NPI',
      subjectId: npi,
    },
    orderBy: [
      { lastDetectedAt: 'desc' },
      { firstDetectedAt: 'desc' },
    ],
    select: {
      anomalyKey: true,
      severity: true,
      status: true,
      occurrenceCount: true,
      firstDetectedAt: true,
      lastDetectedAt: true,
      resolvedAt: true,
      lastFingerprint: true,
      metadata: true,
    },
  });

  const history = rows
    .filter(isDivergenceAnomaly)
    .map((row): DivergenceHistoryEntry => {
      const severity: DivergenceSeverity =
        row.severity === 'HIGH' || row.severity === 'MEDIUM' || row.severity === 'LOW'
          ? row.severity
          : 'MEDIUM';
      const status: DivergenceHistoryEntry['status'] =
        row.status === 'RESOLVED' || row.status === 'REJECTED' || row.status === 'CONFIRMED'
          ? row.status
          : 'OPEN';

      return {
        conflictId: row.anomalyKey,
        ruleId: ruleIdFromMetadata(row.metadata),
        claimType: asString(asRecord(row.metadata).claimType) ?? 'UNKNOWN',
        severity,
        status,
        description: descriptionFromMetadata(row.metadata),
        sources: sourcesFromMetadata(row.metadata),
        values: valuesFromMetadata(row.metadata),
        firstDetectedAt: row.firstDetectedAt.toISOString(),
        lastDetectedAt: row.lastDetectedAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        occurrenceCount: row.occurrenceCount,
        resolutionNote: resolutionNote(row.metadata),
      };
    });

  return {
    npi,
    count: history.length,
    openCount: history.filter((entry) => entry.status === 'OPEN' || entry.status === 'CONFIRMED').length,
    resolvedCount: history.filter((entry) => entry.status === 'RESOLVED').length,
    history,
    computedAt: new Date().toISOString(),
  };
}

export async function getActiveDivergencePenalty(npi: string): Promise<{ penalty: number; hasBlocking: boolean }> {
  const report = await detectDivergence(npi);
  return {
    penalty: report.totalPenalty,
    hasBlocking: report.hasBlocking,
  };
}

export async function resolveDivergenceConflict(input: {
  npi: string;
  conflictId: string;
  resolvedBy: string;
  note?: string;
}): Promise<ResolveDivergenceResult | null> {
  const existing = await prisma.anomalyHistory.findUnique({
    where: { anomalyKey: input.conflictId },
    select: {
      anomalyKey: true,
      subjectType: true,
      subjectId: true,
      metadata: true,
      severity: true,
    },
  });

  if (!existing || existing.subjectType !== 'NPI' || existing.subjectId !== input.npi || !isDivergenceAnomaly({
    anomalyKey: existing.anomalyKey,
    severity: existing.severity,
    status: 'OPEN',
    occurrenceCount: 0,
    firstDetectedAt: new Date(),
    lastDetectedAt: new Date(),
    resolvedAt: null,
    lastFingerprint: '',
    metadata: existing.metadata,
  })) {
    return null;
  }

  const resolvedAt = new Date();
  const note = asString(input.note);
  const metadata = {
    ...asRecord(existing.metadata),
    kind: 'TRUST_DIVERGENCE',
    resolutionNote: note,
    resolvedBy: input.resolvedBy,
    resolvedAt: resolvedAt.toISOString(),
  };
  const actionHash = sha256ForPayload({
    type: 'TRUST_DIVERGENCE_RESOLVED',
    npi: input.npi,
    conflictId: input.conflictId,
    resolvedBy: input.resolvedBy,
    note,
    resolvedAt: resolvedAt.toISOString(),
  });

  const auditEvent = await prisma.$transaction(async (tx) => {
    const created = await tx.auditEvent.create({
      data: {
        type: 'TRUST_DIVERGENCE_RESOLVED',
        hash: actionHash,
        referenceId: input.conflictId,
        clinicianId: input.npi,
        anchored: false,
        metadata,
      },
    });

    await tx.anomalyHistory.update({
      where: { anomalyKey: input.conflictId },
      data: {
        status: 'RESOLVED',
        resolvedAt,
        metadata,
      },
    });

    return created;
  });

  appendAuditEvent({
    category: 'VERIFICATION',
    actor: input.resolvedBy,
    resource: `divergence:${input.conflictId}`,
    severity: 'INFO',
    requestFields: {
      npi: input.npi,
      conflictId: input.conflictId,
      note,
    },
    resultFields: {
      resolvedAt: resolvedAt.toISOString(),
      auditEventId: auditEvent.id,
    },
  });

  return {
    npi: input.npi,
    conflictId: input.conflictId,
    resolution: 'RESOLVED',
    resolvedAt: resolvedAt.toISOString(),
    auditEventId: auditEvent.id,
    note,
  };
}

export function divergencePenaltyForSeverity(severity: DivergenceSeverity): number {
  return severityPenalty(severity);
}

export function divergenceConfidenceForSeverity(severity: DivergenceSeverity): number {
  return confidenceForSeverity(severity);
}
