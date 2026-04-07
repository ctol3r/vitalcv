import { sha256Hex, stableSerialize, type ProvenanceMetadata } from './ProvenanceTracker';
import type { CredentialFactEvent } from '../events/CredentialFactEvents';
import type { SourceMode } from './AdapterInterface';

export type CanonicalFactType =
  | 'IdentityClaim'
  | 'License'
  | 'Certification'
  | 'Sanction'
  | 'EnrollmentPrivilege'
  | 'Education'
  | 'EmploymentAffiliation'
  | 'EvidenceArtifact'
  | 'SourceProvenance'
  | 'MonitoringSubscription';

type BaseFact = Readonly<{
  factId: string;
  factType: CanonicalFactType;
  subjectId: string;
  source: string;
  observedAt: string;
  effectiveAt?: string;
  expiresAt?: string;
}>;

export type IdentityClaimFact = BaseFact &
  Readonly<{
    factType: 'IdentityClaim';
    npi: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    organizationName?: string;
    otherNames?: readonly string[];
    enumerationType: string;
    taxonomies: readonly string[];
    practiceStates: readonly string[];
    practiceLocations?: readonly string[];
    endpoints?: readonly string[];
  }>;

export type LicenseFact = BaseFact &
  Readonly<{
    factType: 'License';
    licenseNumber: string;
    licenseNumberLast4: string;
    jurisdiction: string;
    status: string;
    issuingBody: string;
    discipline: readonly string[];
  }>;

export type CertificationFact = BaseFact &
  Readonly<{
    factType: 'Certification';
    certificationName: string;
    issuer: string;
    status: string;
  }>;

export type SanctionFact = BaseFact &
  Readonly<{
    factType: 'Sanction';
    sanctionType: string;
    status: string;
    summary: string;
  }>;

export type EnrollmentPrivilegeFact = BaseFact &
  Readonly<{
    factType: 'EnrollmentPrivilege';
    enrollmentType: string;
    status: string;
    payerOrProgram: string;
  }>;

export type EducationFact = BaseFact &
  Readonly<{
    factType: 'Education';
    institution: string;
    program: string;
    status: string;
  }>;

export type EmploymentAffiliationFact = BaseFact &
  Readonly<{
    factType: 'EmploymentAffiliation';
    employer: string;
    role: string;
    status: string;
  }>;

export type EvidenceArtifactFact = BaseFact &
  Readonly<{
    factType: 'EvidenceArtifact';
    artifactType: 'RAW_RESPONSE';
    mimeType: string;
    location: string;
    contentHash: string;
    redacted: boolean;
    sizeBytes?: number;
  }>;

export type SourceProvenanceFact = BaseFact &
  Readonly<{
    factType: 'SourceProvenance';
    sourceRecordId?: string;
    endpoint: string;
    sourceDisplayName: string;
    sourceMode: SourceMode;
    retrievalMethod: string;
  }>;

export type MonitoringSubscriptionFact = BaseFact &
  Readonly<{
    factType: 'MonitoringSubscription';
    subscriptionId: string;
    monitoredSubject: string;
    status: 'ACTIVE' | 'PAUSED' | 'ERROR';
    deliveryMethod: 'POLLING' | 'WEBHOOK';
    cursor?: string;
    webhookTarget?: string;
    institutionId: string;
  }>;

export type CanonicalCredentialFact =
  | IdentityClaimFact
  | LicenseFact
  | CertificationFact
  | SanctionFact
  | EnrollmentPrivilegeFact
  | EducationFact
  | EmploymentAffiliationFact
  | EvidenceArtifactFact
  | SourceProvenanceFact
  | MonitoringSubscriptionFact;

export type FactPolicyMetadata = Readonly<{
  sourcePolicyId: string;
  retentionDays: number;
  allowedConsumers: readonly string[];
}>;

export type CredentialFactEnvelope<TFact extends CanonicalCredentialFact = CanonicalCredentialFact> =
  Readonly<{
    fact: TFact;
    provenance: ProvenanceMetadata;
    policy: FactPolicyMetadata;
  }>;

export type PersistedArtifactStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'EXPIRED'
  | 'NOT_FOUND'
  | 'ERROR';

export type CredentialFactBatch = Readonly<{
  batchId: string;
  subjectId: string;
  source: string;
  sourceMode: SourceMode;
  adapterVersion: string;
  retrievalTime: string;
  queryKind: string;
  queryHash: string;
  rawResponse: unknown;
  rawResponseHash: string;
  evidencePointer: string;
  idempotencyKey: string;
  facts: readonly CredentialFactEnvelope[];
  events: readonly CredentialFactEvent[];
  summary: Readonly<{
    status: PersistedArtifactStatus;
    sourceUrl: string;
    factCount: number;
    licenseNumber?: string;
    state?: string;
    expiresAt?: string;
    monitoringEnabled?: boolean;
  }>;
}>;

export type AdapterQueryAuditRecord = Readonly<{
  subjectId: string;
  source: string;
  queryHash: string;
  queryKind: string;
  retrievalMethod: string;
  occurredAt: string;
  traceparent?: string;
}>;

export type DisclosureAuditRecord = Readonly<{
  subjectId: string;
  source: string;
  audience: string;
  occurredAt: string;
  disclosureHash: string;
  factIds: readonly string[];
}>;

export type PersistBatchInput = Readonly<{
  batch: CredentialFactBatch;
  organizationId?: string;
}>;

export type PersistedBatchRecord = Readonly<{
  artifactId: string;
  idempotent: boolean;
  status: PersistedArtifactStatus;
  factCount: number;
  eventCount: number;
}>;

export type AdapterStatusSnapshot = Readonly<{
  lastRun?: string;
  artifactCount: number;
  readinessScore?: number;
  activeSources: readonly string[];
}>;

export interface CanonicalCredentialFactStore {
  persistBatch(input: PersistBatchInput): Promise<PersistedBatchRecord>;
  recordQueryAudit(input: AdapterQueryAuditRecord): Promise<void>;
  recordDisclosureAudit(input: DisclosureAuditRecord): Promise<void>;
  getStatus(subjectId: string, sourceIds?: readonly string[]): Promise<AdapterStatusSnapshot>;
}

export function buildDeterministicId(namespace: string, value: unknown): string {
  return `${namespace}_${sha256Hex(stableSerialize(value)).slice(0, 24)}`;
}

export function buildBatchId(source: string, subjectId: string, rawResponseHash: string): string {
  return buildDeterministicId('batch', {
    source,
    subjectId,
    rawResponseHash,
  });
}

export function buildIdempotencyKey(source: string, subjectId: string, rawResponseHash: string): string {
  return sha256Hex(
    stableSerialize({
      source,
      subjectId,
      rawResponseHash,
    }),
  );
}

export function createFactEnvelope<TFact extends CanonicalCredentialFact>(input: {
  fact: TFact;
  provenance: ProvenanceMetadata;
  policy: FactPolicyMetadata;
}): CredentialFactEnvelope<TFact> {
  return Object.freeze({
    fact: Object.freeze(input.fact),
    provenance: Object.freeze(input.provenance),
    policy: Object.freeze(input.policy),
  });
}

export function createCredentialFactBatch(input: {
  subjectId: string;
  source: string;
  sourceMode: SourceMode;
  adapterVersion: string;
  retrievalTime: string;
  queryKind: string;
  queryHash: string;
  rawResponse: unknown;
  rawResponseHash: string;
  evidencePointer: string;
  facts: readonly CredentialFactEnvelope[];
  events?: readonly CredentialFactEvent[];
  summary: CredentialFactBatch['summary'];
}): CredentialFactBatch {
  const batchId = buildBatchId(input.source, input.subjectId, input.rawResponseHash);
  const idempotencyKey = buildIdempotencyKey(input.source, input.subjectId, input.rawResponseHash);

  return Object.freeze({
    batchId,
    subjectId: input.subjectId,
    source: input.source,
    sourceMode: input.sourceMode,
    adapterVersion: input.adapterVersion,
    retrievalTime: input.retrievalTime,
    queryKind: input.queryKind,
    queryHash: input.queryHash,
    rawResponse: input.rawResponse,
    rawResponseHash: input.rawResponseHash,
    evidencePointer: input.evidencePointer,
    idempotencyKey,
    facts: Object.freeze([...input.facts]),
    events: Object.freeze([...(input.events ?? [])]),
    summary: Object.freeze({
      ...input.summary,
      factCount: input.facts.length,
    }),
  });
}
