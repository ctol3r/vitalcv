import { listInvestigatorFindings } from '../investigators/investigatorEngineService';
import {
  listPredictionInsights,
  type PredictionQuery,
} from '../predictions/predictionEngineService';
import { listStorylines } from '../storylines/storylineService';
import {
  insightToFeedItem,
  findingToFeedItem,
  predictionToFeedItem,
  storylineToFeedItem,
} from './intelligenceAdapters';
import { listEarlyWarningFeedItems } from './earlyWarningService';
import {
  listInstitutionInsights,
  listProviderInsights,
  listSpecialtyInsights,
} from './providerIntelligenceService';
import { dedupeStrings, stableIntelligenceId, type IntelligenceFeedItem } from './intelligenceDomain';

export interface IntelligenceFeedQuery {
  entityType?: string;
  entityId?: string;
  includeTypes?: string[] | null;
  limit?: number;
}

function matchesType(item: IntelligenceFeedItem, includeTypes: Set<string>): boolean {
  return includeTypes.size === 0 || includeTypes.has(item.type);
}

function matchesEntity(item: IntelligenceFeedItem, entityType?: string, entityId?: string): boolean {
  if (!entityType || !entityId) {
    return true;
  }

  return item.entityRefs.some((entity) => entity.entityType === entityType && entity.entityId === entityId);
}

function normalizeIncludeTypes(includeTypes?: string[] | null): Set<string> {
  return new Set(
    (includeTypes ?? [])
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

function predictionQueryForEntity(entityType?: string, entityId?: string): PredictionQuery {
  if (!entityType || !entityId) {
    return {
      limit: 60,
      offset: 0,
      sync: false,
    };
  }

  return {
    entityType,
    entityId,
    limit: 60,
    offset: 0,
    sync: false,
  };
}

export async function listIntelligenceFeed(query: IntelligenceFeedQuery = {}): Promise<{
  generatedAt: string;
  items: IntelligenceFeedItem[];
}> {
  const generatedAt = new Date().toISOString();
  const includeTypes = normalizeIncludeTypes(query.includeTypes);
  const limit = Math.min(Math.max(query.limit ?? 40, 1), 200);

  const [findingResult, storylines, predictions, providerInsights, specialtyInsights, institutionInsights, warnings] = await Promise.all([
    listInvestigatorFindings({
      provider: query.entityType === 'provider' ? query.entityId ?? null : null,
      institution: query.entityType === 'institution' ? query.entityId ?? null : null,
      limit: Math.max(limit, 50),
      offset: 0,
    }),
    listStorylines({
      provider: query.entityType === 'provider' ? query.entityId : undefined,
      institution: query.entityType === 'institution' ? query.entityId : undefined,
      perspective: query.entityType === 'network' ? 'network' : undefined,
      limit: Math.max(limit, 50),
      sync: false,
    }),
    listPredictionInsights(predictionQueryForEntity(query.entityType, query.entityId)),
    listProviderInsights({
      sync: false,
      limit: Math.max(limit, 50),
    }),
    listSpecialtyInsights({
      sync: false,
      limit: Math.max(limit, 50),
    }),
    listInstitutionInsights({
      sync: false,
      limit: Math.max(limit, 50),
    }),
    listEarlyWarningFeedItems({
      entityType: query.entityType,
      entityId: query.entityId,
      limit: Math.max(limit, 25),
    }),
  ]);

  const rawItems = [
    ...findingResult.findings.map((finding) => findingToFeedItem(finding)),
    ...storylines.storylines.map((storyline) => storylineToFeedItem(storyline)),
    ...predictions.predictions.map((prediction) => predictionToFeedItem(prediction)),
    ...providerInsights.insights.map((insight) => insightToFeedItem(insight)),
    ...specialtyInsights.insights.map((insight) => insightToFeedItem(insight)),
    ...institutionInsights.insights.map((insight) => insightToFeedItem(insight)),
    ...warnings,
  ];

  const deduped = new Map<string, IntelligenceFeedItem>();
  for (const item of rawItems) {
    if (!matchesType(item, includeTypes) || !matchesEntity(item, query.entityType, query.entityId)) {
      continue;
    }

    const key = stableIntelligenceId(item.type, item.id || item.headline);
    const current = deduped.get(key);
    if (!current) {
      deduped.set(key, item);
      continue;
    }

    if (Date.parse(item.updatedAt) > Date.parse(current.updatedAt)) {
      deduped.set(key, {
        ...item,
        linkedEvidenceRefs: dedupeStrings([...item.linkedEvidenceRefs, ...current.linkedEvidenceRefs]),
        recommendedActionRefs: dedupeStrings([...item.recommendedActionRefs, ...current.recommendedActionRefs]),
      });
    }
  }

  const items = [...deduped.values()]
    .sort((left, right) => (
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      || right.confidence.score - left.confidence.score
      || left.headline.localeCompare(right.headline)
    ))
    .slice(0, limit);

  return {
    generatedAt,
    items,
  };
}
