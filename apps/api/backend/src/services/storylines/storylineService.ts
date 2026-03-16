import { createHash } from 'node:crypto';
import type {
  StorylineEvidenceItem,
  StorylineFindingInput,
  StorylinePerspective,
  StorylineSeverity,
  StorylineSnapshot,
  StorylineStatus,
  StorylineTimeline,
  StorylineTimelineEvent,
  StorylineTimelineEventType,
  StorylineType,
} from '../../../../../../core/storylines/storylineEngine';
import { createStorylineEngine } from '../../../../../../core/storylines/storylineEngine';
import type { InvestigatorFindingRecord } from '../../../../../../core/investigators/investigatorTypes';
import { listInvestigatorFindings } from '../investigators/investigatorEngineService';
import type {
  StorylineActionEventRow,
  StorylineActionTypeRecord,
  StorylineEntityLinkRow,
  StorylineEntityTypeRecord,
  StorylineEventTypeRecord,
  StorylineFindingLinkRow,
  StorylinePerspectiveRecord,
  StorylineRecordRow,
  StorylineSeverityRecord,
  StorylineStatusEventRow,
  StorylineStatusRecord,
  StorylineTypeRecord,
} from './storylineStore';
import {
  getStorylineRecord,
  listStorylineRecords,
  mutateStorylineRecord,
  upsertStorylineRecord,
} from './storylineStore';
import type { PredictionSummaryContract } from '../predictions/contracts';
import { getPredictionSummariesForEntityKeys } from '../predictions/predictionEngineService';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256Hex(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function toCoreSeverity(severity: string): StorylineSeverity {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    case 'INFO':
    default:
      return 'info';
  }
}

function toDbSeverity(severity: StorylineSeverity): StorylineSeverityRecord {
  switch (severity) {
    case 'critical':
      return 'CRITICAL';
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
    case 'info':
    default:
      return 'INFO';
  }
}

function toCoreStatus(status: StorylineStatusRecord): StorylineStatus {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'QUIET':
      return 'quiet';
    case 'ESCALATED':
      return 'escalated';
    case 'RESOLVED':
      return 'resolved';
    case 'ARCHIVED':
    default:
      return 'archived';
  }
}

function toDbStatus(status: StorylineStatus): StorylineStatusRecord {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'quiet':
      return 'QUIET';
    case 'escalated':
      return 'ESCALATED';
    case 'resolved':
      return 'RESOLVED';
    case 'archived':
    default:
      return 'ARCHIVED';
  }
}

function toCoreType(type: StorylineTypeRecord): StorylineType {
  switch (type) {
    case 'TRUST_DECLINE':
      return 'trust decline';
    case 'RISING_INVESTIGATOR':
      return 'rising investigator';
    case 'NETWORK_EMERGENCE':
      return 'network emergence';
    case 'COMPLIANCE_RISK':
      return 'compliance risk';
    case 'WORKFORCE_OPPORTUNITY':
      return 'workforce opportunity';
    case 'INSTITUTION_SHIFT':
      return 'institution shift';
    case 'INDUSTRY_INFLUENCE':
    default:
      return 'industry influence';
  }
}

function toDbType(type: StorylineType): StorylineTypeRecord {
  switch (type) {
    case 'trust decline':
      return 'TRUST_DECLINE';
    case 'rising investigator':
      return 'RISING_INVESTIGATOR';
    case 'network emergence':
      return 'NETWORK_EMERGENCE';
    case 'compliance risk':
      return 'COMPLIANCE_RISK';
    case 'workforce opportunity':
      return 'WORKFORCE_OPPORTUNITY';
    case 'institution shift':
      return 'INSTITUTION_SHIFT';
    case 'industry influence':
    default:
      return 'INDUSTRY_INFLUENCE';
  }
}

function toCorePerspective(perspective: StorylinePerspectiveRecord): StorylinePerspective {
  switch (perspective) {
    case 'PROVIDER':
      return 'provider';
    case 'INSTITUTION':
      return 'institution';
    case 'NETWORK':
    default:
      return 'network';
  }
}

function toDbPerspective(perspective: StorylinePerspective): StorylinePerspectiveRecord {
  switch (perspective) {
    case 'provider':
      return 'PROVIDER';
    case 'institution':
      return 'INSTITUTION';
    case 'network':
    default:
      return 'NETWORK';
  }
}

function toCoreTimelineEventType(eventType: StorylineEventTypeRecord): StorylineTimelineEventType {
  switch (eventType) {
    case 'ORIGIN':
      return 'origin';
    case 'UPDATED':
      return 'update';
    case 'QUIET_PERIOD':
      return 'quiet_period';
    case 'REACTIVATED':
      return 'reactivated';
    case 'RESOLVED':
      return 'resolved';
    case 'ESCALATED':
      return 'escalated';
    case 'ARCHIVED':
      return 'archived';
    case 'ACKNOWLEDGED':
    default:
      return 'acknowledged';
  }
}

function toDbTimelineEventType(eventType: StorylineTimelineEventType): StorylineEventTypeRecord {
  switch (eventType) {
    case 'origin':
      return 'ORIGIN';
    case 'update':
      return 'UPDATED';
    case 'quiet_period':
      return 'QUIET_PERIOD';
    case 'reactivated':
      return 'REACTIVATED';
    case 'resolved':
      return 'RESOLVED';
    case 'escalated':
      return 'ESCALATED';
    case 'archived':
      return 'ARCHIVED';
    case 'acknowledged':
    case 'investigation_saved':
    default:
      return 'ACKNOWLEDGED';
  }
}

function toCoreEvidenceItems(value: unknown): StorylineEvidenceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asRecord(entry))
    .filter((entry) => typeof entry.bullet === 'string')
    .map((entry) => ({
      bullet: String(entry.bullet),
      source: typeof entry.source === 'string' ? entry.source : 'unknown',
      confidence: typeof entry.confidence === 'number' ? entry.confidence : 0,
      observedAt: typeof entry.observedAt === 'string' ? entry.observedAt : new Date().toISOString(),
      findingId: typeof entry.findingId === 'string' ? entry.findingId : undefined,
      artifactId: typeof entry.artifactId === 'string' ? entry.artifactId : undefined,
    }));
}

function toCoreTimeline(row: StorylineRecordRow): StorylineTimeline {
  const events = (row.statusEvents ?? []).map((event): StorylineTimelineEvent => ({
    eventKey: event.eventKey,
    type: toCoreTimelineEventType(event.eventType),
    summary: event.summary,
    occurredAt: event.occurredAt.toISOString(),
    findingIds: asStringArray(asRecord(event.metadata).findingIds),
    fromStatus: event.fromStatus ? toCoreStatus(event.fromStatus) : undefined,
    toStatus: event.toStatus ? toCoreStatus(event.toStatus) : undefined,
    metadata: asRecord(event.metadata),
  }));
  const originEvent = events.find((event) => event.type === 'origin') ?? events[0] ?? {
    eventKey: sha256Hex({ storylineId: row.storylineId, type: 'origin' }).slice(0, 24),
    type: 'origin',
    summary: 'Storyline persisted without an origin event.',
    occurredAt: row.createdAt.toISOString(),
    findingIds: row.findingIds,
    toStatus: toCoreStatus(row.status),
    metadata: {},
  };

  return {
    originEvent,
    events: events.length > 0 ? events : [originEvent],
    quietPeriods: events.filter((event) => event.type === 'quiet_period').length,
    reactivations: events.filter((event) => event.type === 'reactivated').length,
    lastEventAt: (events[events.length - 1]?.occurredAt ?? row.updatedAt.toISOString()),
    lastActivityAt: row.lastActivityAt.toISOString(),
    currentStatus: toCoreStatus(row.status),
  };
}

function toCoreSnapshot(row: StorylineRecordRow): StorylineSnapshot {
  const metadata = asRecord(row.metadata);
  const groupingStrategy: 'entity_anchored' | 'event_anchored' | 'trend_anchored' =
    metadata.groupingStrategy === 'trend_anchored' || metadata.groupingStrategy === 'event_anchored'
      ? metadata.groupingStrategy
      : row.entityIds.length > 1
        ? 'trend_anchored'
        : typeof metadata.storylineAnchorType === 'string' && metadata.storylineAnchorType === 'event'
          ? 'event_anchored'
          : 'entity_anchored';
  return {
    storylineId: row.storylineId,
    fingerprint: row.fingerprint,
    storylineType: toCoreType(row.storylineType),
    perspective: toCorePerspective(row.perspective),
    headline: row.title,
    title: row.title,
    summary: row.summary,
    whyItMatters: row.whyItMatters,
    recommendedActions: asStringArray(row.recommendedActions),
    severity: toCoreSeverity(row.severity),
    maxSeverity: toCoreSeverity(row.severity),
    confidence: row.confidence,
    entityIds: row.entityIds,
    findingIds: row.findingIds,
    supportingEvidence: toCoreEvidenceItems(row.supportingEvidence),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    firstEvent: row.createdAt.toISOString(),
    lastEvent: row.lastActivityAt.toISOString(),
    groupingStrategy,
    status: toCoreStatus(row.status),
    progressionScore: row.progressionScore,
    noveltyScore: row.noveltyScore,
    persistenceScore: row.persistenceScore,
    escalationThreshold: row.escalationThreshold,
    timeline: toCoreTimeline(row),
    metadata,
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function prefixedEntityId(prefix: string, raw: string): string {
  return `${prefix}:${raw}`;
}

function normalizeInstitutionKey(raw: string): string {
  return raw.includes('-') || raw.includes('_') || /^[a-f0-9-]{8,}$/i.test(raw)
    ? raw.toLowerCase()
    : slugify(raw);
}

function extractFindingEntities(finding: InvestigatorFindingRecord): {
  entityIds: string[];
  providerIds: string[];
  institutionIds: string[];
  graphEntityIds: string[];
} {
  const metadata = asRecord(finding.metadata);
  const providerValues = new Set<string>();
  const institutionValues = new Set<string>();
  const graphValues = new Set<string>();
  const entityValues = new Set<string>();

  for (const entity of finding.entities) {
    if (entity.entityType === 'provider') {
      providerValues.add(entity.entityId);
    }
    if (entity.entityType === 'institution') {
      institutionValues.add(normalizeInstitutionKey(entity.entityLabel ?? entity.entityId));
    }
  }

  for (const candidate of [
    metadata.npi,
    metadata.providerNpi,
    metadata.subjectNpi,
    metadata.providerId,
  ]) {
    const value = stringValue(candidate);
    if (value) {
      providerValues.add(value);
    }
  }

  for (const candidate of [
    ...asStringArray(metadata.providerIds),
    ...asStringArray(metadata.npis),
  ]) {
    providerValues.add(candidate);
  }

  for (const candidate of [
    metadata.organizationId,
    metadata.institutionId,
    metadata.organizationSlug,
    metadata.institutionSlug,
    metadata.organization,
    metadata.institution,
  ]) {
    const value = stringValue(candidate);
    if (value) {
      institutionValues.add(normalizeInstitutionKey(value));
    }
  }

  for (const candidate of [
    ...asStringArray(metadata.affiliations),
    ...asStringArray(metadata.institutions),
    ...asStringArray(metadata.organizationIds),
    ...asStringArray(metadata.institutionIds),
  ]) {
    institutionValues.add(normalizeInstitutionKey(candidate));
  }

  for (const providerId of providerValues) {
    const entityId = prefixedEntityId('provider', providerId);
    entityValues.add(entityId);
    graphValues.add(entityId);
  }

  for (const institutionId of institutionValues) {
    const entityId = prefixedEntityId('institution', institutionId);
    entityValues.add(entityId);
    graphValues.add(entityId);
  }

  for (const raw of [
    ...asStringArray(metadata.entityIds),
    ...asStringArray(metadata.relatedEntityIds),
    ...asStringArray(metadata.graphEntityIds),
    ...asStringArray(metadata.networkEntityIds),
  ]) {
    const normalized = raw.includes(':') ? raw : prefixedEntityId('entity', slugify(raw));
    entityValues.add(normalized);
    graphValues.add(normalized);
  }

  return {
    entityIds: [...entityValues],
    providerIds: [...providerValues].map((value) => prefixedEntityId('provider', value)),
    institutionIds: [...institutionValues].map((value) => prefixedEntityId('institution', value)),
    graphEntityIds: [...graphValues],
  };
}

function toStorylineFindingInput(finding: InvestigatorFindingRecord): StorylineFindingInput {
  const entities = extractFindingEntities(finding);
  return {
    findingId: finding.findingId,
    category: finding.findingType.toUpperCase(),
    severity: toCoreSeverity(finding.severity),
    title: finding.title,
    summary: finding.summary,
    explanation: finding.explanation,
    entityIds: entities.entityIds,
    providerIds: entities.providerIds,
    institutionIds: entities.institutionIds,
    graphEntityIds: entities.graphEntityIds,
    relatedFindingIds: [],
    evidence: finding.supportingEvidence.map((item) => ({
      source: item.sourceLabel ?? item.sourceId ?? 'unknown',
      claim: item.snippet ?? item.evidenceType,
      confidence: finding.confidence,
      timestamp: item.observedAt ?? finding.updatedAt,
      artifactId: item.recordType === 'verification_artifact' ? item.recordId ?? undefined : undefined,
    })),
    actions: [],
    metadata: finding.metadata,
    createdAt: finding.updatedAt,
  };
}

function linkWeight(severity: StorylineSeverityRecord, evidenceCount: number): number {
  const severityWeight = severity === 'CRITICAL'
    ? 1
    : severity === 'HIGH'
      ? 0.85
      : severity === 'MEDIUM'
        ? 0.65
        : severity === 'LOW'
          ? 0.45
          : 0.25;
  return Math.min(1, severityWeight + Math.min(evidenceCount, 4) * 0.05);
}

function toEntityLink(entityId: string, clusterFirstSeenAt: string, clusterLastSeenAt: string): {
  entityType: StorylineEntityTypeRecord;
  entityKey: string;
  entityLabel?: string | null;
  weight: number;
  firstSeenAt: string;
  lastSeenAt: string;
} {
  const [prefix, raw] = entityId.includes(':') ? entityId.split(':', 2) : ['entity', entityId];
  const entityKey = raw ?? entityId;
  switch (prefix) {
    case 'provider':
      return {
        entityType: 'PROVIDER',
        entityKey,
        entityLabel: `Provider ${entityKey}`,
        weight: 1,
        firstSeenAt: clusterFirstSeenAt,
        lastSeenAt: clusterLastSeenAt,
      };
    case 'institution':
      return {
        entityType: 'INSTITUTION',
        entityKey,
        entityLabel: entityKey.replace(/[-_]+/g, ' '),
        weight: 0.9,
        firstSeenAt: clusterFirstSeenAt,
        lastSeenAt: clusterLastSeenAt,
      };
    case 'network':
      return {
        entityType: 'NETWORK',
        entityKey,
        entityLabel: entityKey,
        weight: 0.7,
        firstSeenAt: clusterFirstSeenAt,
        lastSeenAt: clusterLastSeenAt,
      };
    default:
      return {
        entityType: 'GENERIC',
        entityKey,
        entityLabel: entityKey,
        weight: 0.6,
        firstSeenAt: clusterFirstSeenAt,
        lastSeenAt: clusterLastSeenAt,
      };
  }
}

function toActionTypeRecord(actionType: 'acknowledge' | 'escalate' | 'archive' | 'save-investigation'): StorylineActionTypeRecord {
  switch (actionType) {
    case 'acknowledge':
      return 'ACKNOWLEDGE';
    case 'escalate':
      return 'ESCALATE';
    case 'archive':
      return 'ARCHIVE';
    case 'save-investigation':
    default:
      return 'SAVE_INVESTIGATION';
  }
}

function buildActionEventKey(
  storylineId: string,
  actionType: string,
  occurredAt: string,
  actorId?: string,
): string {
  return sha256Hex({
    storylineId,
    actionType,
    occurredAt,
    actorId: actorId ?? null,
  }).slice(0, 24);
}

const storylineEngine = createStorylineEngine();
let syncInFlight: Promise<string> | null = null;
let lastSyncedAt: string | null = null;

async function syncStorylines(): Promise<string> {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    const now = new Date().toISOString();
    const findingsResponse = await listInvestigatorFindings({
      status: ['new', 'acknowledged', 'investigating'],
      limit: 500,
      offset: 0,
    });
    const findings = findingsResponse.findings.map(toStorylineFindingInput);
    const existingRows = await listStorylineRecords({
      includeDetails: true,
      limit: 500,
    });
    const existingByFingerprint = new Map(
      existingRows.map((row) => [row.fingerprint, row] as const),
    );
    const result = storylineEngine.buildStorylines({
      findings,
      existingStorylines: existingRows.map(toCoreSnapshot),
      now,
    });

    for (const storyline of result.storylines) {
      const cluster = result.clusters.find((candidate) => candidate.fingerprint === storyline.fingerprint);
      const existing = existingByFingerprint.get(storyline.fingerprint);
      const existingEventKeys = new Set(existing?.statusEvents?.map((event) => event.eventKey) ?? []);

      await upsertStorylineRecord({
        storyline: {
          storylineId: storyline.storylineId,
          fingerprint: storyline.fingerprint,
          storylineType: toDbType(storyline.storylineType),
          perspective: toDbPerspective(storyline.perspective),
          title: storyline.title,
          summary: storyline.summary,
          whyItMatters: storyline.whyItMatters,
          severity: toDbSeverity(storyline.severity),
          confidence: storyline.confidence,
          entityIds: storyline.entityIds,
          findingIds: storyline.findingIds,
          supportingEvidence: storyline.supportingEvidence,
          recommendedActions: storyline.recommendedActions,
          progressionScore: storyline.progressionScore,
          noveltyScore: storyline.noveltyScore,
          persistenceScore: storyline.persistenceScore,
          escalationThreshold: storyline.escalationThreshold,
          lastActivityAt: storyline.lastActivityAt,
          status: toDbStatus(storyline.status),
          metadata: storyline.metadata,
          createdAt: storyline.createdAt,
        },
        findingLinks: cluster
          ? cluster.findings.map((finding) => ({
              findingId: finding.findingId,
              findingCategory: finding.category,
              findingSeverity: toDbSeverity(finding.severity),
              observedAt: finding.createdAt,
              weight: linkWeight(toDbSeverity(finding.severity), finding.evidence.length),
              snapshot: {
                title: finding.title,
                summary: finding.summary,
                explanation: finding.explanation,
                evidence: finding.evidence,
                actions: finding.actions,
                metadata: finding.metadata,
                entityIds: finding.entityIds,
              },
            }))
          : undefined,
        entityLinks: cluster
          ? cluster.entityIds.map((entityId) => toEntityLink(entityId, cluster.firstObservedAt, cluster.lastObservedAt))
          : undefined,
        statusEvents: storyline.timeline.events
          .filter((event) => !existingEventKeys.has(event.eventKey))
          .map((event) => ({
            eventKey: event.eventKey,
            eventType: toDbTimelineEventType(event.type),
            summary: event.summary,
            fromStatus: event.fromStatus ? toDbStatus(event.fromStatus) : undefined,
            toStatus: event.toStatus ? toDbStatus(event.toStatus) : undefined,
            metadata: {
              ...event.metadata,
              findingIds: event.findingIds,
            },
            occurredAt: event.occurredAt,
          })),
      });
    }

    lastSyncedAt = result.generatedAt;
    return result.generatedAt;
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

export interface StorylineQueryFilters {
  storylineType?: StorylineType;
  severity?: StorylineSeverity;
  status?: StorylineStatus;
  provider?: string;
  institution?: string;
  perspective?: StorylinePerspective;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  sync?: boolean;
}

export async function listStorylines(filters: StorylineQueryFilters = {}): Promise<{
  storylines: StorylineWithPredictionSnapshot[];
  syncedAt: string;
}> {
  const syncedAt = filters.sync === false
    ? (lastSyncedAt ?? new Date().toISOString())
    : await syncStorylines();
  const rows = await listStorylineRecords({
    storylineType: filters.storylineType ? toDbType(filters.storylineType) : undefined,
    severity: filters.severity ? toDbSeverity(filters.severity) : undefined,
    status: filters.status ? toDbStatus(filters.status) : undefined,
    perspective: filters.perspective ? toDbPerspective(filters.perspective) : undefined,
    provider: filters.provider,
    institution: filters.institution ? normalizeInstitutionKey(filters.institution) : undefined,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    includeDetails: true,
    limit: filters.limit,
  });

  const storylines = rows.map(toCoreSnapshot);
  const predictionSummaries = await getPredictionSummariesForEntityKeys(
    storylines.flatMap((storyline) => storyline.entityIds),
    { sync: filters.sync },
  );

  return {
    storylines: storylines.map((storyline) => ({
      ...storyline,
      predictionSummary: summarizeStorylinePredictions(storyline.entityIds, predictionSummaries),
    })),
    syncedAt,
  };
}

export interface StorylineWithPredictionSnapshot extends StorylineSnapshot {
  predictionSummary?: PredictionSummaryContract;
  headline?: string;
  maxSeverity?: StorylineSeverity;
  firstEvent?: string;
  lastEvent?: string;
  groupingStrategy?: 'entity_anchored' | 'event_anchored' | 'trend_anchored';
}

export interface StorylineFindingLinkContract {
  findingId: string;
  findingCategory: string;
  findingSeverity: StorylineSeverity;
  observedAt: string;
  weight: number;
  snapshot: Record<string, unknown>;
}

export interface StorylineEntityLinkContract {
  entityType: 'provider' | 'institution' | 'network' | 'generic';
  entityKey: string;
  entityLabel: string | null;
  weight: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface StorylineActionEventContract {
  eventKey: string;
  actionType: 'acknowledge' | 'escalate' | 'archive' | 'save_investigation';
  actorId: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

function toEntityLinkContract(row: StorylineEntityLinkRow): StorylineEntityLinkContract {
  return {
    entityType: row.entityType === 'PROVIDER'
      ? 'provider'
      : row.entityType === 'INSTITUTION'
        ? 'institution'
        : row.entityType === 'NETWORK'
          ? 'network'
          : 'generic',
    entityKey: row.entityKey,
    entityLabel: row.entityLabel,
    weight: row.weight,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

function toFindingLinkContract(row: StorylineFindingLinkRow): StorylineFindingLinkContract {
  return {
    findingId: row.findingId,
    findingCategory: row.findingCategory,
    findingSeverity: toCoreSeverity(row.findingSeverity),
    observedAt: row.observedAt.toISOString(),
    weight: row.weight,
    snapshot: asRecord(row.snapshot),
  };
}

function toActionEventContract(row: StorylineActionEventRow): StorylineActionEventContract {
  return {
    eventKey: row.eventKey,
    actionType: row.actionType === 'ACKNOWLEDGE'
      ? 'acknowledge'
      : row.actionType === 'ESCALATE'
        ? 'escalate'
        : row.actionType === 'ARCHIVE'
          ? 'archive'
          : 'save_investigation',
    actorId: row.actorId,
    note: row.note,
    payload: asRecord(row.payload),
    occurredAt: row.occurredAt.toISOString(),
  };
}

export interface StorylineDetailContract {
  storyline: StorylineWithPredictionSnapshot;
  findingLinks: StorylineFindingLinkContract[];
  entityLinks: StorylineEntityLinkContract[];
  statusEvents: StorylineTimelineEvent[];
  actionEvents: StorylineActionEventContract[];
}

function summarizeStorylinePredictions(
  entityIds: string[],
  summaries: Map<string, PredictionSummaryContract>,
): PredictionSummaryContract {
  const relevant = entityIds
    .map((entityId) => summaries.get(entityId))
    .filter((summary): summary is PredictionSummaryContract => Boolean(summary?.available))
    .flatMap((summary) => summary.predictions);

  if (relevant.length === 0) {
    return {
      available: false,
      total: 0,
      updatedAt: null,
      topPrediction: null,
      predictions: [],
      byType: [],
      byState: [],
    };
  }

  const deduped = [...new Map(relevant.map((prediction) => [prediction.id, prediction])).values()]
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const byType = new Map<string, number>();
  const byState = new Map<string, number>();
  for (const prediction of deduped) {
    byType.set(prediction.type, (byType.get(prediction.type) ?? 0) + 1);
    byState.set(prediction.state, (byState.get(prediction.state) ?? 0) + 1);
  }

  return {
    available: true,
    total: deduped.length,
    updatedAt: deduped[0]?.updatedAt ?? null,
    topPrediction: deduped[0] ?? null,
    predictions: deduped.slice(0, 5),
    byType: [...byType.entries()].map(([key, count]) => ({ key, count })),
    byState: [...byState.entries()].map(([key, count]) => ({ key, count })),
  };
}

function toDetailContract(
  row: StorylineRecordRow,
  predictionSummary: PredictionSummaryContract,
): StorylineDetailContract {
  const storyline = toCoreSnapshot(row);
  return {
    storyline: {
      ...storyline,
      predictionSummary,
    },
    findingLinks: (row.findingLinks ?? []).map((link) => toFindingLinkContract(link)),
    entityLinks: (row.entityLinks ?? []).map(toEntityLinkContract),
    statusEvents: storyline.timeline.events,
    actionEvents: (row.actionEvents ?? []).map(toActionEventContract),
  };
}

export async function getStorylineDetail(
  storylineId: string,
  options: { sync?: boolean } = {},
): Promise<StorylineDetailContract | null> {
  if (options.sync !== false) {
    await syncStorylines();
  }

  const row = await getStorylineRecord(storylineId);
  if (!row) {
    return null;
  }

  const predictionSummaries = await getPredictionSummariesForEntityKeys(row.entityIds, { sync: options.sync });
  return toDetailContract(row, summarizeStorylinePredictions(row.entityIds, predictionSummaries));
}

async function applyAction(input: {
  storylineId: string;
  actionType: 'acknowledge' | 'escalate' | 'archive' | 'save-investigation';
  actorId?: string;
  note?: string;
  payload?: Record<string, unknown>;
}): Promise<StorylineDetailContract | null> {
  await syncStorylines();
  const current = await getStorylineRecord(input.storylineId);
  if (!current) {
    return null;
  }

  const occurredAt = new Date().toISOString();
  const nextStatus = input.actionType === 'acknowledge'
    ? 'QUIET'
    : input.actionType === 'escalate'
      ? 'ESCALATED'
      : input.actionType === 'archive'
        ? 'ARCHIVED'
        : undefined;
  const statusEvent = nextStatus
    ? {
        eventKey: buildActionEventKey(
          input.storylineId,
          `${input.actionType}:status`,
          occurredAt,
          input.actorId,
        ),
        eventType: (input.actionType === 'acknowledge'
          ? 'ACKNOWLEDGED'
          : input.actionType === 'escalate'
            ? 'ESCALATED'
            : 'ARCHIVED') as StorylineEventTypeRecord,
        summary: input.actionType === 'acknowledge'
          ? 'Storyline acknowledged and moved into a quiet state.'
          : input.actionType === 'escalate'
            ? 'Storyline manually escalated.'
            : 'Storyline manually archived.',
        fromStatus: current.status,
        toStatus: nextStatus as StorylineStatusRecord,
        metadata: input.payload,
        occurredAt,
      }
    : undefined;
  const updated = await mutateStorylineRecord({
    storylineId: input.storylineId,
    nextStatus,
    statusEvent,
    actionEvent: {
      eventKey: buildActionEventKey(
        input.storylineId,
        input.actionType,
        occurredAt,
        input.actorId,
      ),
      actionType: toActionTypeRecord(input.actionType),
      actorId: input.actorId,
      note: input.note,
      payload: input.payload,
      occurredAt,
    },
    patch: input.actionType === 'escalate'
      ? {
          progressionScore: Math.min(1, current.progressionScore + 0.08),
        }
      : undefined,
  });

  if (!updated) {
    return null;
  }

  const predictionSummaries = await getPredictionSummariesForEntityKeys(updated.entityIds, { sync: false });
  return toDetailContract(updated, summarizeStorylinePredictions(updated.entityIds, predictionSummaries));
}

export async function acknowledgeStoryline(input: {
  storylineId: string;
  actorId?: string;
  note?: string;
}): Promise<StorylineDetailContract | null> {
  return applyAction({
    storylineId: input.storylineId,
    actionType: 'acknowledge',
    actorId: input.actorId,
    note: input.note,
  });
}

export async function escalateStoryline(input: {
  storylineId: string;
  actorId?: string;
  note?: string;
}): Promise<StorylineDetailContract | null> {
  return applyAction({
    storylineId: input.storylineId,
    actionType: 'escalate',
    actorId: input.actorId,
    note: input.note,
  });
}

export async function archiveStoryline(input: {
  storylineId: string;
  actorId?: string;
  note?: string;
}): Promise<StorylineDetailContract | null> {
  return applyAction({
    storylineId: input.storylineId,
    actionType: 'archive',
    actorId: input.actorId,
    note: input.note,
  });
}

export async function saveStorylineInvestigation(input: {
  storylineId: string;
  actorId?: string;
  note?: string;
  payload?: Record<string, unknown>;
}): Promise<StorylineDetailContract | null> {
  return applyAction({
    storylineId: input.storylineId,
    actionType: 'save-investigation',
    actorId: input.actorId,
    note: input.note,
    payload: input.payload,
  });
}
