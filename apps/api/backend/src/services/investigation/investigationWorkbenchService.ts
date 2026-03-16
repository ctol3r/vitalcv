import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { buildFeedItem, stableIntelligenceId, type IntelligenceFeedItem, type IntelligencePriority } from '../intelligence/intelligenceDomain';
import { listIntelligenceFeed } from '../intelligence/intelligenceFeedService';
import {
  getInvestigatorFinding,
  listInvestigatorFindings,
} from '../investigators/investigatorEngineService';
import { investigateProvider } from './investigationEngineService';
import {
  buildFindingsBusDispatchBundle,
  routeFindingsBusEvent,
} from './findingsBus';
import {
  buildGraphInvestigationPayload,
  type GraphInvestigationQuery,
} from './graphInvestigationService';
import {
  buildStorylineConsolePayload,
  getHardenedStorylineDetail,
} from './storylineIntelligenceService';
import type {
  EvidenceViewerPayload,
  FindingsInboxPayload,
  FindingsInboxRow,
  InvestigationFeedItem,
  InvestigationFeedPayload,
  ProviderInvestigationPayload,
  StorylineInvestigationPayload,
} from './contracts';
import { listStorylines } from '../storylines/storylineService';

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function priorityWeight(priority: IntelligencePriority | null | undefined): number {
  switch (priority) {
    case 'critical':
      return 1;
    case 'high':
      return 0.8;
    case 'medium':
      return 0.6;
    case 'low':
      return 0.35;
    default:
      return 0.2;
  }
}

function recencyWeight(updatedAt: string): number {
  const days = Math.max(0, (Date.now() - Date.parse(updatedAt)) / (1000 * 60 * 60 * 24));
  return clamp01(1 - (days / 21), 0.1);
}

function noveltyWeight(item: IntelligenceFeedItem): number {
  const metadata = item.metadata ?? {};
  for (const candidate of [
    metadata.noveltyScore,
    metadata.progressionScore,
    metadata.persistenceScore,
  ]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return clamp01(candidate);
    }
  }

  if (item.type === 'network_change') {
    return 0.8;
  }
  if (item.type === 'watchlist_alert') {
    return 0.72;
  }
  return 0.45;
}

function analystRelevance(item: IntelligenceFeedItem, entityType?: string, entityId?: string): number {
  const directEntityMatch = entityType && entityId
    ? item.entityRefs.some((entity) => entity.entityType === entityType && entity.entityId === entityId)
    : false;

  if (directEntityMatch) {
    return 1;
  }
  if (item.type === 'finding' || item.type === 'storyline' || item.type === 'watchlist_alert') {
    return 0.8;
  }
  if (item.type === 'network_change' || item.type === 'investigation_summary') {
    return 0.7;
  }
  return 0.55;
}

function actionUrgency(item: IntelligenceFeedItem): number {
  const base = priorityWeight(item.priority);
  if (item.type === 'watchlist_alert') {
    return clamp01(base + 0.15);
  }
  if (item.type === 'finding') {
    return clamp01(base + 0.1);
  }
  return base;
}

function rankInvestigationFeedItem(
  item: IntelligenceFeedItem,
  entityType?: string,
  entityId?: string,
): InvestigationFeedItem {
  const rankingInputs = {
    analystRelevance: analystRelevance(item, entityType, entityId),
    severity: Math.max(priorityWeight(item.priority), priorityWeight(item.impact)),
    recency: recencyWeight(item.updatedAt),
    novelty: noveltyWeight(item),
    actionUrgency: actionUrgency(item),
    total: 0,
  };

  rankingInputs.total = clamp01(
    (rankingInputs.analystRelevance * 0.22)
      + (rankingInputs.severity * 0.25)
      + (rankingInputs.recency * 0.18)
      + (rankingInputs.novelty * 0.15)
      + (rankingInputs.actionUrgency * 0.2),
  );

  return {
    ...item,
    rankingInputs,
  };
}

function findingToInboxRow(finding: Awaited<ReturnType<typeof listInvestigatorFindings>>['findings'][number]): FindingsInboxRow {
  const storylineRef = finding.storylineKey ?? null;
  const providerLabel = finding.entities.find((entity) => entity.entityType === 'provider')?.entityLabel
    ?? (typeof finding.metadata.npi === 'string' ? finding.metadata.npi : null);
  return {
    findingId: finding.findingId,
    type: finding.findingType,
    provider: providerLabel,
    investigatorSource: finding.investigatorId,
    confidence: finding.confidence,
    storylineRef,
    state: finding.status,
    severity: finding.severity,
    timestamp: finding.updatedAt,
    title: finding.title,
    summary: finding.summary,
    busDispatches: routeFindingsBusEvent(finding),
  };
}

async function findingsInboxFromFindingIds(
  findingIds: string[],
): Promise<FindingsInboxPayload> {
  const details = await Promise.all(findingIds.map((findingId) => getInvestigatorFinding(findingId)));
  const rows = details
    .filter((finding): finding is NonNullable<typeof finding> => Boolean(finding))
    .map((finding) => findingToInboxRow(finding));

  return {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    rows,
  };
}

export async function buildFindingsInboxPayload(
  input: {
    providerId?: string | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<FindingsInboxPayload> {
  const findings = await listInvestigatorFindings({
    provider: input.providerId ?? null,
    limit: input.limit ?? 25,
    offset: input.offset ?? 0,
  });

  return {
    generatedAt: new Date().toISOString(),
    total: findings.total,
    rows: findings.findings.map((finding) => findingToInboxRow(finding)),
  };
}

export async function buildEvidenceViewerPayload(
  evidenceId: string,
  prismaClient: PrismaClient = prisma,
): Promise<EvidenceViewerPayload | null> {
  const rows = await prismaClient.findingEvidenceLink.findMany({
    where: { evidenceId },
    include: {
      finding: true,
    },
    take: 12,
  });

  if (rows.length === 0) {
    return null;
  }

  const primary = rows[0]!;
  return {
    evidenceId,
    evidenceType: primary.evidenceType,
    provenance: primary.sourceLabel ?? primary.sourceId ?? primary.recordType ?? 'unknown',
    source: primary.sourceLabel ?? primary.sourceId,
    retrievalMethod: primary.recordType ?? primary.evidenceType,
    retrievalTime: primary.observedAt?.toISOString() ?? null,
    transformations: Object.keys((primary.metadata as Record<string, unknown>) ?? {}),
    snippet: primary.snippet,
    url: primary.url,
    recordType: primary.recordType,
    recordId: primary.recordId,
    relatedFindings: rows.map((row) => ({
      findingId: row.finding.findingId,
      investigatorId: row.finding.investigatorId,
      title: row.finding.title,
      storylineKey: row.finding.storylineKey,
    })),
    metadata: primary.metadata as Record<string, unknown>,
  };
}

function syntheticNetworkChangeItems(
  storylines: Awaited<ReturnType<typeof listStorylines>>['storylines'],
): IntelligenceFeedItem[] {
  return storylines
    .filter((storyline) => ['network emergence', 'institution shift'].includes(storyline.storylineType))
    .slice(0, 6)
    .map((storyline) => buildFeedItem({
      id: stableIntelligenceId('network_change', storyline.storylineId),
      type: 'network_change',
      headline: storyline.title,
      summary: storyline.summary,
      entityRefs: storyline.entityIds.map((entityId) => ({
        entityType: entityId.split(':')[0] ?? 'entity',
        entityId,
        entityLabel: entityId,
      })),
      confidence: storyline.confidence,
      priority: storyline.severity === 'critical' ? 'critical' : storyline.severity === 'high' ? 'high' : 'medium',
      impact: storyline.severity === 'critical' ? 'critical' : 'high',
      linkedEvidenceRefs: storyline.findingIds,
      recommendedActionRefs: storyline.recommendedActions,
      createdAt: storyline.createdAt,
      updatedAt: storyline.updatedAt,
      metadata: {
        storylineId: storyline.storylineId,
        storylineType: storyline.storylineType,
        progressionScore: storyline.progressionScore,
      },
    }));
}

function syntheticWatchlistAlertItems(
  findings: Awaited<ReturnType<typeof listInvestigatorFindings>>['findings'],
): IntelligenceFeedItem[] {
  return findings
    .filter((finding) => ['critical', 'high'].includes(finding.severity) && ['new', 'investigating'].includes(finding.status))
    .slice(0, 6)
    .map((finding) => buildFeedItem({
      id: stableIntelligenceId('watchlist_alert', finding.findingId),
      type: 'watchlist_alert',
      headline: finding.title,
      summary: finding.summary,
      entityRefs: finding.entities.map((entity) => ({
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityLabel: entity.entityLabel ?? entity.entityId,
      })),
      confidence: finding.confidence,
      priority: finding.severity === 'critical' ? 'critical' : 'high',
      impact: finding.severity === 'critical' ? 'critical' : 'high',
      linkedEvidenceRefs: finding.supportingEvidence.map((evidence) => evidence.evidenceId),
      recommendedActionRefs: [`review:${finding.findingId}`],
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
      metadata: {
        findingId: finding.findingId,
        findingType: finding.findingType,
        severity: finding.severity,
      },
    }));
}

function syntheticInvestigationSummaryItem(
  provider: ProviderInvestigationPayload['providerSummary'],
): IntelligenceFeedItem {
  return buildFeedItem({
    id: stableIntelligenceId('investigation_summary', provider.npi),
    type: 'investigation_summary',
    headline: `${provider.providerName} investigation summary`,
    summary: `${provider.providerName} is in trust band ${provider.trustBreakdown.bandLabel} with ${provider.anomalySummary.anomalyCount} active investigation anomalies.`,
    entityRefs: [{
      entityType: 'provider',
      entityId: provider.npi,
      entityLabel: provider.providerName,
    }],
    confidence: provider.trustBreakdown.confidence,
    priority: provider.anomalySummary.overallSeverity === 'CRITICAL'
      ? 'critical'
      : provider.anomalySummary.overallSeverity === 'HIGH'
        ? 'high'
        : 'medium',
    impact: provider.anomalySummary.overallSeverity === 'CRITICAL'
      ? 'critical'
      : provider.anomalySummary.overallSeverity === 'HIGH'
        ? 'high'
        : 'medium',
    linkedEvidenceRefs: provider.searchEvidence.map((evidence) => evidence.id),
    recommendedActionRefs: provider.trustBreakdown.recommendations,
    createdAt: provider.trustBreakdown.timeline[0]?.recordedAt ?? provider.searchEvidence[0]?.id,
    updatedAt: provider.trustBreakdown.timeline[provider.trustBreakdown.timeline.length - 1]?.recordedAt ?? new Date().toISOString(),
    metadata: {
      trustScore: provider.trustBreakdown.score,
      trustBand: provider.trustBreakdown.band,
      anomalyCount: provider.anomalySummary.anomalyCount,
    },
  });
}

export async function listInvestigationFeed(
  input: {
    entityType?: string;
    entityId?: string;
    limit?: number;
  } = {},
): Promise<InvestigationFeedPayload> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const [baseFeed, findings, storylines, providerSummary] = await Promise.all([
    listIntelligenceFeed({
      entityType: input.entityType,
      entityId: input.entityId,
      limit: Math.max(limit, 30),
    }),
    listInvestigatorFindings({
      provider: input.entityType === 'provider' ? input.entityId ?? null : null,
      limit: 20,
      offset: 0,
    }),
    listStorylines({
      provider: input.entityType === 'provider' ? input.entityId : undefined,
      limit: 20,
      sync: false,
    }),
    input.entityType === 'provider' && input.entityId
      ? investigateProvider(input.entityId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const synthetic = [
    ...syntheticNetworkChangeItems(storylines.storylines),
    ...syntheticWatchlistAlertItems(findings.findings),
    ...(providerSummary ? [syntheticInvestigationSummaryItem(providerSummary)] : []),
  ];

  const items = [...baseFeed.items, ...synthetic]
    .map((item) => rankInvestigationFeedItem(item, input.entityType, input.entityId))
    .sort((left, right) => (
      right.rankingInputs.total - left.rankingInputs.total
      || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    ))
    .slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    total: items.length,
    items,
  };
}

export async function buildProviderInvestigationPayload(
  providerId: string,
): Promise<ProviderInvestigationPayload> {
  const [providerSummary, findingsInbox, storylines, feed, network] = await Promise.all([
    investigateProvider(providerId),
    buildFindingsInboxPayload({ providerId, limit: 25 }),
    listStorylines({ provider: providerId, limit: 8, sync: false }),
    listInvestigationFeed({ entityType: 'provider', entityId: providerId, limit: 20 }),
    buildGraphInvestigationPayload({ providerId }),
  ]);

  const storylineConsoles = (await Promise.all(
    storylines.storylines.map((storyline) => buildStorylineConsolePayload(storyline.storylineId)),
  )).filter((payload): payload is NonNullable<typeof payload> => Boolean(payload));

  return {
    generatedAt: new Date().toISOString(),
    providerId,
    providerSummary,
    findingsInbox,
    storylines: storylineConsoles,
    feed: feed.items,
    network,
  };
}

export async function buildStorylineInvestigationPayload(
  storylineId: string,
): Promise<StorylineInvestigationPayload | null> {
  const detail = await getHardenedStorylineDetail(storylineId);
  if (!detail) {
    return null;
  }

  const console = await buildStorylineConsolePayload(storylineId);
  if (!console) {
    return null;
  }

  const providerId = detail.linkedEntities.find((entity) => entity.entityType === 'provider')?.entityKey ?? null;
  const [findingsInbox, feed, network] = await Promise.all([
    findingsInboxFromFindingIds(detail.storyline.findingIds),
    listInvestigationFeed(providerId ? { entityType: 'provider', entityId: providerId, limit: 16 } : { limit: 16 }),
    buildGraphInvestigationPayload({
      providerId,
      storylineId,
    } satisfies GraphInvestigationQuery),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    storylineId,
    detail,
    console,
    findingsInbox,
    feed: feed.items,
    network,
  };
}
