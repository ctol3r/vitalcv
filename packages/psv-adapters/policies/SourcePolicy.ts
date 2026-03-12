import type { CanonicalFactType } from '../core/CredentialFactMapper';
import type { ProvenanceMetadata } from '../core/ProvenanceTracker';
import type { SourceMode } from '../core/AdapterInterface';

export type ConsumerAudience =
  | 'INTERNAL_TRUST_ENGINE'
  | 'VERIFIER'
  | 'CLINICIAN'
  | 'EMPLOYER'
  | 'AUDITOR';

export class SourcePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourcePolicyError';
  }
}

type DisclosureFieldMap = Partial<Record<CanonicalFactType, readonly string[]>>;

export type SourcePolicyDefinition = Readonly<{
  id: string;
  displayName: string;
  mode: SourceMode;
  permittedFactTypes: readonly CanonicalFactType[];
  allowedConsumers: readonly ConsumerAudience[];
  allowedDisclosureFields: Readonly<Record<ConsumerAudience, DisclosureFieldMap>>;
  eligibility: Readonly<{
    publicAccessible: boolean;
    contractRequired: boolean;
    institutionalEnrollment: boolean;
  }>;
  retentionDays: Readonly<{
    rawPayload: number;
    evidencePointer: number;
    facts: number;
  }>;
  requiredAuditFields: readonly (keyof ProvenanceMetadata)[];
}>;

const ALL_FACT_FIELDS = Object.freeze(['*'] as const);

export const DEFAULT_SOURCE_POLICIES = Object.freeze({
  'npi-registry': {
    id: 'npi-registry',
    displayName: 'CMS NPI Registry',
    mode: 'PUBLIC_API',
    permittedFactTypes: ['IdentityClaim', 'EvidenceArtifact', 'SourceProvenance'],
    allowedConsumers: ['INTERNAL_TRUST_ENGINE', 'VERIFIER', 'CLINICIAN', 'AUDITOR'],
    allowedDisclosureFields: {
      INTERNAL_TRUST_ENGINE: {
        IdentityClaim: ALL_FACT_FIELDS,
        EvidenceArtifact: ALL_FACT_FIELDS,
        SourceProvenance: ALL_FACT_FIELDS,
      },
      VERIFIER: {
        IdentityClaim: [
          'factId',
          'factType',
          'subjectId',
          'npi',
          'fullName',
          'enumerationType',
          'taxonomies',
          'practiceStates',
        ],
        EvidenceArtifact: ['factId', 'factType', 'artifactType', 'location', 'contentHash', 'redacted'],
        SourceProvenance: ['factId', 'factType', 'endpoint', 'sourceDisplayName', 'retrievalMethod'],
      },
      CLINICIAN: {
        IdentityClaim: ALL_FACT_FIELDS,
        EvidenceArtifact: ['factId', 'factType', 'artifactType', 'location', 'contentHash'],
        SourceProvenance: ['factId', 'factType', 'endpoint', 'sourceDisplayName', 'retrievalMethod'],
      },
      EMPLOYER: {
        IdentityClaim: ['factId', 'factType', 'subjectId', 'npi', 'fullName', 'enumerationType'],
        EvidenceArtifact: ['factId', 'factType', 'artifactType', 'location'],
        SourceProvenance: ['factId', 'factType', 'sourceDisplayName', 'retrievalMethod'],
      },
      AUDITOR: {
        IdentityClaim: ALL_FACT_FIELDS,
        EvidenceArtifact: ALL_FACT_FIELDS,
        SourceProvenance: ALL_FACT_FIELDS,
      },
    },
    eligibility: {
      publicAccessible: true,
      contractRequired: false,
      institutionalEnrollment: false,
    },
    retentionDays: {
      rawPayload: 30,
      evidencePointer: 365,
      facts: 365,
    },
    requiredAuditFields: [
      'source',
      'retrieval_time',
      'retrieval_method',
      'evidence_pointer',
      'raw_response_hash',
    ],
  },
  'nursys-enotify': {
    id: 'nursys-enotify',
    displayName: 'Nursys e-Notify',
    mode: 'LICENSED_API',
    permittedFactTypes: ['License', 'EvidenceArtifact', 'SourceProvenance', 'MonitoringSubscription'],
    allowedConsumers: ['INTERNAL_TRUST_ENGINE', 'VERIFIER', 'AUDITOR'],
    allowedDisclosureFields: {
      INTERNAL_TRUST_ENGINE: {
        License: ALL_FACT_FIELDS,
        EvidenceArtifact: ALL_FACT_FIELDS,
        SourceProvenance: ALL_FACT_FIELDS,
        MonitoringSubscription: ALL_FACT_FIELDS,
      },
      VERIFIER: {
        License: [
          'factId',
          'factType',
          'subjectId',
          'licenseNumberLast4',
          'jurisdiction',
          'status',
          'issuingBody',
          'expiresAt',
          'discipline',
        ],
        EvidenceArtifact: ['factId', 'factType', 'artifactType', 'location', 'contentHash', 'redacted'],
        SourceProvenance: ['factId', 'factType', 'endpoint', 'sourceDisplayName', 'retrievalMethod'],
      },
      CLINICIAN: {},
      EMPLOYER: {},
      AUDITOR: {
        License: ALL_FACT_FIELDS,
        EvidenceArtifact: ALL_FACT_FIELDS,
        SourceProvenance: ALL_FACT_FIELDS,
        MonitoringSubscription: ALL_FACT_FIELDS,
      },
    },
    eligibility: {
      publicAccessible: false,
      contractRequired: true,
      institutionalEnrollment: true,
    },
    retentionDays: {
      rawPayload: 7,
      evidencePointer: 365,
      facts: 365,
    },
    requiredAuditFields: [
      'source',
      'retrieval_time',
      'retrieval_method',
      'evidence_pointer',
      'raw_response_hash',
    ],
  },
} satisfies Record<string, SourcePolicyDefinition>);

export function getSourcePolicy(sourceId: string): SourcePolicyDefinition {
  const policy = DEFAULT_SOURCE_POLICIES[sourceId as keyof typeof DEFAULT_SOURCE_POLICIES];
  if (!policy) {
    throw new SourcePolicyError(`No source policy registered for ${sourceId}`);
  }
  return policy;
}

export function assertFactsAllowedByPolicy(
  sourceId: string,
  factTypes: readonly CanonicalFactType[],
): void {
  const policy = getSourcePolicy(sourceId);

  for (const factType of factTypes) {
    if (!policy.permittedFactTypes.includes(factType)) {
      throw new SourcePolicyError(
        `Fact type ${factType} is not permitted for source policy ${policy.id}`,
      );
    }
  }
}
