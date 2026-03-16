import type { InvestigatorFindingRecord } from '../../../../../../core/investigators/investigatorTypes';
import type {
  FindingsBusDispatch,
  FindingsBusEvent,
  FindingsBusEventContext,
  InvestigatorRuntimeDescriptor,
} from './contracts';
import { listInvestigatorRuntimeDescriptors } from './investigatorRuntimeService';

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function providerIdsForFinding(finding: InvestigatorFindingRecord): string[] {
  const ids = finding.entities
    .filter((entity) => entity.entityType === 'provider')
    .map((entity) => entity.entityId);
  const metadata = finding.metadata ?? {};
  const metadataIds = [
    typeof metadata.npi === 'string' ? metadata.npi : null,
    typeof metadata.providerNpi === 'string' ? metadata.providerNpi : null,
    typeof metadata.subjectNpi === 'string' ? metadata.subjectNpi : null,
  ].filter((value): value is string => Boolean(value));
  return unique([...ids, ...metadataIds, ...finding.entityIds.filter((entityId) => /^\d{10}$/.test(entityId))]);
}

function institutionIdsForFinding(finding: InvestigatorFindingRecord): string[] {
  return unique(
    finding.entities
      .filter((entity) => entity.entityType === 'institution')
      .map((entity) => entity.entityId),
  );
}

function eventContext(finding: InvestigatorFindingRecord): FindingsBusEventContext {
  return {
    entityIds: [...finding.entityIds],
    providerIds: providerIdsForFinding(finding),
    institutionIds: institutionIdsForFinding(finding),
    storylineKey: finding.storylineKey ?? null,
    findingType: finding.findingType,
    severity: finding.severity,
    confidence: finding.confidence,
    evidenceIds: finding.supportingEvidence.map((evidence) => evidence.evidenceId),
    sourceIds: unique(
      finding.supportingEvidence
        .map((evidence) => evidence.sourceId ?? evidence.sourceLabel ?? '')
        .filter((value) => value.length > 0),
    ),
    observedAt: finding.updatedAt,
    tags: unique([
      finding.findingType,
      finding.severity,
      ...providerIdsForFinding(finding).map((providerId) => `provider:${providerId}`),
      ...institutionIdsForFinding(finding).map((institutionId) => `institution:${institutionId}`),
    ]),
  };
}

export function buildFindingsBusEvent(finding: InvestigatorFindingRecord): FindingsBusEvent {
  return {
    eventId: `${finding.findingId}:finding.emitted`,
    eventType: `finding.${finding.findingType}`,
    findingId: finding.findingId,
    publisherInvestigatorId: finding.investigatorId,
    findingTitle: finding.title,
    summary: finding.summary,
    context: eventContext(finding),
  };
}

function matchesDescriptor(
  descriptor: InvestigatorRuntimeDescriptor,
  finding: InvestigatorFindingRecord,
): { reason: string; contextKeys: string[] } | null {
  for (const subscription of descriptor.subscriptions) {
    if (subscription.findingTypes?.includes(finding.findingType)) {
      return {
        reason: `${descriptor.name} subscribes to ${finding.findingType} findings.`,
        contextKeys: unique([
          'findingType',
          'providerIds',
          'institutionIds',
          ...(subscription.relationshipTypes ?? []),
        ]),
      };
    }

    if (subscription.sources.some((source) => (
      finding.supportingEvidence.some((evidence) => evidence.sourceId === source || evidence.sourceLabel === source)
    ))) {
      return {
        reason: `${descriptor.name} watches ${subscription.sources.join(', ')} source activity.`,
        contextKeys: unique(['sourceIds', 'providerIds', 'storylineKey']),
      };
    }
  }

  return null;
}

export function routeFindingsBusEvent(
  finding: InvestigatorFindingRecord,
  descriptors = listInvestigatorRuntimeDescriptors(),
): FindingsBusDispatch[] {
  return descriptors
    .filter((descriptor) => !descriptor.engineInvestigatorIds.includes(finding.investigatorId))
    .map((descriptor) => {
      const match = matchesDescriptor(descriptor, finding);
      if (!match) {
        return null;
      }

      return {
        targetInvestigatorId: descriptor.id,
        reason: match.reason,
        eventType: `finding.${finding.findingType}`,
        contextKeys: match.contextKeys,
      } satisfies FindingsBusDispatch;
    })
    .filter((dispatch): dispatch is FindingsBusDispatch => Boolean(dispatch));
}

export function buildFindingsBusDispatchBundle(
  finding: InvestigatorFindingRecord,
  descriptors = listInvestigatorRuntimeDescriptors(),
): {
  event: FindingsBusEvent;
  dispatches: FindingsBusDispatch[];
} {
  return {
    event: buildFindingsBusEvent(finding),
    dispatches: routeFindingsBusEvent(finding, descriptors),
  };
}
