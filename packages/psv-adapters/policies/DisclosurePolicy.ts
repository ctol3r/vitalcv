import type {
  CanonicalCredentialFact,
  CredentialFactBatch,
  CredentialFactEnvelope,
} from '../core/CredentialFactMapper';
import { createDisclosureAuditDigest } from '../core/ProvenanceTracker';
import type { ConsumerAudience, SourcePolicyDefinition } from './SourcePolicy';

export type DisclosureRequest = Readonly<{
  audience: ConsumerAudience;
  factTypes?: readonly string[];
}>;

export type ProjectedCredentialFactBatch = Readonly<{
  batchId: string;
  subjectId: string;
  source: string;
  audience: ConsumerAudience;
  disclosureHash: string;
  facts: readonly CredentialFactEnvelope[];
  summary: CredentialFactBatch['summary'];
}>;

export class DisclosurePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisclosurePolicyError';
  }
}

function projectFact(
  fact: CanonicalCredentialFact,
  allowedFields: readonly string[],
): CanonicalCredentialFact {
  if (allowedFields.includes('*')) {
    return fact;
  }

  const projected = Object.fromEntries(
    Object.entries(fact).filter(([key]) => allowedFields.includes(key)),
  ) as CanonicalCredentialFact;

  return Object.freeze(projected);
}

export function projectBatchForDisclosure(
  batch: CredentialFactBatch,
  sourcePolicy: SourcePolicyDefinition,
  request: DisclosureRequest,
): ProjectedCredentialFactBatch {
  if (!sourcePolicy.allowedConsumers.includes(request.audience)) {
    throw new DisclosurePolicyError(
      `Audience ${request.audience} is not permitted for source ${sourcePolicy.id}`,
    );
  }

  const fieldMap = sourcePolicy.allowedDisclosureFields[request.audience];
  const requestedFactTypes = request.factTypes ? new Set(request.factTypes) : null;
  const projectedFacts: CredentialFactEnvelope[] = [];

  for (const envelope of batch.facts) {
    if (requestedFactTypes && !requestedFactTypes.has(envelope.fact.factType)) {
      continue;
    }

    const allowedFields = fieldMap[envelope.fact.factType];
    if (!allowedFields || allowedFields.length === 0) {
      if (requestedFactTypes?.has(envelope.fact.factType)) {
        throw new DisclosurePolicyError(
          `No disclosure fields configured for ${envelope.fact.factType} and audience ${request.audience}`,
        );
      }
      continue;
    }

    projectedFacts.push(
      Object.freeze({
        ...envelope,
        fact: projectFact(envelope.fact, allowedFields),
      }),
    );
  }

  const disclosureHash = createDisclosureAuditDigest({
    batchId: batch.batchId,
    audience: request.audience,
    factIds: projectedFacts.map((entry) => entry.fact.factId),
  });

  return Object.freeze({
    batchId: batch.batchId,
    subjectId: batch.subjectId,
    source: batch.source,
    audience: request.audience,
    disclosureHash,
    facts: Object.freeze(projectedFacts),
    summary: batch.summary,
  });
}
