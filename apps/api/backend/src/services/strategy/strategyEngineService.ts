import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import {
  createStrategyEngine,
  type StrategyEntityRef,
  type StrategyImpactLevel,
  type StrategyInsight,
  type StrategyInsightType,
  type StrategyInstitutionSignal,
  type StrategyMarketSignal,
  type StrategyNetworkSignal,
  type StrategyProviderSignal,
  type StrategyScope,
  type StrategySupportingPrediction,
} from '../../../../../../core/strategy/strategyEngine';
import { listStorylines } from '../storylines/storylineService';
import { refreshActionRecommendations } from '../actions/actionEngineService';
import { refreshPredictionInsights } from '../predictions/predictionEngineService';
import { createGraphNodeId } from '../graph-engine/ids';

type LoadedPrediction = StrategySupportingPrediction & {
  targetEntity: {
    entityType: string;
    entityId: string;
    entityLabel?: string | null;
  };
  evidenceSignals: Array<{
    label: string;
    value: number | string;
    direction: 'UP' | 'DOWN' | 'FLAT';
    source?: string | null;
  }>;
};

type LoadedAction = {
  actionId: string;
  targetEntityType: string;
  targetEntityId: string;
  recommendedAction: string;
  createdAt: string;
};

type ProviderContext = {
  npi: string;
  label: string;
  specialty: string | null;
  state: string | null;
  institutions: StrategyEntityRef[];
};

export interface StrategyListQuery {
  type?: StrategyInsightType;
  impactLevel?: StrategyImpactLevel;
  confidence?: number;
  entityType?: string;
  limit?: number;
  sync?: boolean;
}

function asRecord(value: Prisma.JsonValue | Record<string, unknown> | undefined | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function slugify(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCaseFromSlug(value: string): string {
  return value
    .split(/[-_]+/g)
    .filter((entry) => entry.length > 0)
    .map((entry) => entry[0]!.toUpperCase() + entry.slice(1))
    .join(' ');
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))];
}

function parsePredictionEvidenceSignals(value: Prisma.JsonValue): LoadedPrediction['evidenceSignals'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const record = asRecord(entry);
    const direction = asString(record.direction);
    return {
      label: asString(record.label) ?? 'signal',
      value: typeof record.value === 'number' || typeof record.value === 'string'
        ? record.value
        : String(record.value ?? ''),
      direction: direction === 'DOWN' || direction === 'FLAT' ? direction : 'UP',
      source: asString(record.source),
    };
  });
}

async function loadPredictions(
  now: string,
  sync: boolean,
  prismaClient: PrismaClient,
): Promise<LoadedPrediction[]> {
  if (sync) {
    const refreshed = await refreshPredictionInsights(now, prismaClient);
    return refreshed.map((prediction) => ({
      ...prediction,
      targetEntity: prediction.targetEntity,
      evidenceSignals: prediction.evidenceSignals,
    }));
  }

  const rows = await prismaClient.predictionInsight.findMany({
    orderBy: [
      { probability: 'desc' },
      { confidence: 'desc' },
    ],
    take: 250,
  });

  if (rows.length === 0) {
    return loadPredictions(now, true, prismaClient);
  }

  return rows.map((row) => ({
    predictionId: row.predictionId,
    predictionType: row.predictionType,
    targetEntity: {
      entityType: row.targetEntityType,
      entityId: row.targetEntityId,
      entityLabel: row.targetEntityLabel,
    },
    probability: row.probability,
    confidence: row.confidence,
    explanation: row.explanation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: asRecord(row.metadata),
    evidenceSignals: parsePredictionEvidenceSignals(row.evidenceSignals),
  }));
}

async function loadActions(
  now: string,
  sync: boolean,
  prismaClient: PrismaClient,
): Promise<LoadedAction[]> {
  if (sync) {
    const refreshed = await refreshActionRecommendations(now, prismaClient);
    return refreshed.map((action) => ({
      actionId: action.actionId,
      targetEntityType: action.targetEntity.entityType,
      targetEntityId: action.targetEntity.entityId,
      recommendedAction: action.recommendedAction,
      createdAt: action.createdAt,
    }));
  }

  const rows = await prismaClient.actionRecommendation.findMany({
    orderBy: [
      { priorityScore: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 250,
  });

  if (rows.length === 0) {
    return loadActions(now, true, prismaClient);
  }

  return rows
    .filter((row) => !['DISMISSED', 'dismissed', 'EXECUTED', 'completed', 'skipped'].includes(row.status))
    .map((row) => ({
      actionId: row.actionId,
      targetEntityType: row.targetEntityType,
      targetEntityId: row.targetEntityId,
      recommendedAction: row.recommendedAction,
      createdAt: row.createdAt.toISOString(),
    }));
}

function extractInstitution(value: Prisma.JsonValue): string | null {
  const record = asRecord(value);
  return asString(record.institution)
    ?? asString(record.organization)
    ?? asString(record.affiliation)
    ?? asString(record.employer);
}

async function loadProviderContext(
  npis: string[],
  prismaClient: PrismaClient,
): Promise<Map<string, ProviderContext>> {
  if (npis.length === 0) {
    return new Map();
  }

  const uniqueNpis = [...new Set(npis)];
  const [profiles, nodes, claims] = await Promise.all([
    prismaClient.personProfile.findMany({
      where: { npi: { in: uniqueNpis } },
      select: {
        npi: true,
        firstName: true,
        lastName: true,
        specialty: true,
        stateOfPractice: true,
      },
    }),
    prismaClient.graphNode.findMany({
      where: {
        id: {
          in: uniqueNpis.map((npi) => createGraphNodeId({
            type: 'clinician',
            sourceKind: 'npi',
            sourceId: npi,
          })),
        },
      },
      select: {
        id: true,
        label: true,
        metadata: true,
      },
    }),
    prismaClient.claimRecord.findMany({
      where: {
        subjectNpi: { in: uniqueNpis },
        claimType: 'INSTITUTION_AFFILIATION',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        subjectNpi: true,
        value: true,
      },
      take: Math.max(200, uniqueNpis.length * 6),
    }),
  ]);

  const byNpi = new Map<string, ProviderContext>();
  for (const profile of profiles) {
    if (!profile.npi) {
      continue;
    }
    const label = [profile.firstName, profile.lastName]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .trim() || `Provider ${profile.npi}`;
    byNpi.set(profile.npi, {
      npi: profile.npi,
      label,
      specialty: profile.specialty,
      state: profile.stateOfPractice?.toUpperCase() ?? null,
      institutions: [],
    });
  }

  for (const node of nodes) {
    const metadata = asRecord(node.metadata);
    const npi = asString(metadata.npi);
    if (!npi) {
      continue;
    }

    const existing = byNpi.get(npi);
    const label = asString(metadata.fullName) ?? node.label;
    if (!existing) {
      byNpi.set(npi, {
        npi,
        label,
        specialty: asString(metadata.specialty),
        state: (asString(metadata.state) ?? asString(metadata.stateOfPractice))?.toUpperCase() ?? null,
        institutions: [],
      });
      continue;
    }

    if (existing.label.startsWith('Provider ')) {
      existing.label = label;
    }
    if (!existing.specialty) {
      existing.specialty = asString(metadata.specialty);
    }
    if (!existing.state) {
      existing.state = (asString(metadata.state) ?? asString(metadata.stateOfPractice))?.toUpperCase() ?? null;
    }
  }

  for (const claim of claims) {
    const context = byNpi.get(claim.subjectNpi);
    if (!context) {
      continue;
    }

    const institution = extractInstitution(claim.value);
    if (!institution) {
      continue;
    }

    const entityId = `institution:${slugify(institution)}`;
    if (context.institutions.some((entry) => entry.entityId === entityId)) {
      continue;
    }

    context.institutions.push({
      entityType: 'institution',
      entityId,
      entityLabel: institution,
    });
  }

  return byNpi;
}

function predictionSignalValue(
  prediction: LoadedPrediction | undefined,
  label: string,
  fallback = 0,
): number {
  if (!prediction) {
    return fallback;
  }

  const signal = prediction.evidenceSignals.find((entry) => entry.label === label);
  if (!signal) {
    return fallback;
  }

  const parsed = typeof signal.value === 'number' ? signal.value : Number.parseFloat(signal.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scaledPositiveSignal(
  prediction: LoadedPrediction | undefined,
  label: string,
  multiplier: number,
  fallback = 0,
): number {
  return Math.max(0, Math.round(predictionSignalValue(prediction, label, fallback) * multiplier));
}

function pressureScoreForPrediction(prediction: LoadedPrediction): number {
  const shortageProjection = Math.max(
    predictionSignalValue(prediction, 'shortage_projection', asNumber(prediction.metadata.shortageProjection) ?? 0),
    0,
  );
  const demandSupplyRatio = Math.max(
    predictionSignalValue(prediction, 'demand_supply_ratio', asNumber(prediction.metadata.demandSupplyRatio) ?? 0),
    0,
  );
  const wageGrowth = Math.max(
    predictionSignalValue(prediction, 'wage_growth', asNumber(prediction.metadata.wageGrowth) ?? 0),
    0,
  );
  const matchTension = Math.max(
    predictionSignalValue(prediction, 'match_tension', asNumber(prediction.metadata.matchTension) ?? 0),
    0,
  );
  const trainingPipelineCoverage = Math.max(
    predictionSignalValue(
      prediction,
      'training_pipeline_coverage',
      asNumber(prediction.metadata.trainingPipelineCoverage) ?? 0,
    ),
    0,
  );
  const trainingGap = 1 - Math.min(trainingPipelineCoverage, 1.5) / 1.5;

  return Math.max(0, Math.min(100, Math.round(
    (shortageProjection * 32)
    + (demandSupplyRatio * 30)
    + (wageGrowth * 12)
    + (matchTension * 14)
    + (trainingGap * 12)
    + (prediction.probability * 10),
  )));
}

function marketDemandUnits(prediction: LoadedPrediction): number {
  const ratio = Math.max(
    predictionSignalValue(prediction, 'demand_supply_ratio', asNumber(prediction.metadata.demandSupplyRatio) ?? 0),
    0,
  );
  return Math.max(1, Math.round(ratio * 100));
}

function marketSupplyUnits(prediction: LoadedPrediction): number {
  const coverage = Math.max(
    predictionSignalValue(
      prediction,
      'training_pipeline_coverage',
      asNumber(prediction.metadata.trainingPipelineCoverage) ?? 1,
    ),
    1,
  );
  return Math.max(25, Math.round(Math.min(coverage, 2) * 50));
}

function parseMarketScope(prediction: LoadedPrediction): StrategyScope {
  const parts = prediction.targetEntity.entityId.split(':');
  const hasGeography = parts.length >= 3;
  const geography = hasGeography ? parts[1]?.toUpperCase() ?? null : null;
  const specialtySlug = hasGeography
    ? parts[2] ?? slugify(prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId)
    : slugify(prediction.targetEntity.entityLabel ?? prediction.targetEntity.entityId);
  const specialty = prediction.targetEntity.entityLabel?.startsWith(`${geography} `)
    ? prediction.targetEntity.entityLabel.slice(`${geography} `.length)
    : prediction.targetEntity.entityLabel ?? titleCaseFromSlug(specialtySlug);

  return {
    entityType: 'specialty',
    entityId: hasGeography ? `specialty:${geography ?? 'NA'}:${specialtySlug}` : prediction.targetEntity.entityId,
    entityLabel: geography ? `${specialty} in ${geography}` : specialty,
    geography,
    specialty,
  };
}

function providerIdFromEntityId(value: string): string | null {
  const exact = value.match(/\b\d{10}\b/);
  return exact?.[0] ?? null;
}

function providerEntityIds(storyline: {
  entityIds: string[];
}): string[] {
  return uniqueStrings(
    storyline.entityIds.map((entityId) => {
      if (entityId.startsWith('provider:')) {
        return entityId.slice('provider:'.length);
      }
      return providerIdFromEntityId(entityId);
    }),
  );
}

function institutionEntityIds(storyline: {
  entityIds: string[];
}): string[] {
  return uniqueStrings(
    storyline.entityIds
      .filter((entityId) => entityId.startsWith('institution:'))
      .map((entityId) => entityId),
  );
}

function buildActionLookup(actions: LoadedAction[]): Map<string, { labels: string[]; ids: string[] }> {
  const lookup = new Map<string, { labels: string[]; ids: string[] }>();
  for (const action of actions) {
    const key = `${action.targetEntityType}:${action.targetEntityId}`;
    const current = lookup.get(key) ?? { labels: [], ids: [] };
    current.labels.push(action.recommendedAction);
    current.ids.push(action.actionId);
    lookup.set(key, current);
  }
  return lookup;
}

function actionSetFor(
  lookup: Map<string, { labels: string[]; ids: string[] }>,
  entityType: string,
  entityId: string,
): { labels: string[]; ids: string[] } {
  return lookup.get(`${entityType}:${entityId}`) ?? { labels: [], ids: [] };
}

function lexicalSimilarity(left: string, right: string): number {
  const tokenize = (value: string) => normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 1);
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.sqrt(leftTokens.size * rightTokens.size);
}

async function buildStrategyInsights(
  options: { sync?: boolean; now?: string },
  prismaClient: PrismaClient,
): Promise<{ insights: StrategyInsight[]; generatedAt: string }> {
  const now = options.now ?? new Date().toISOString();
  const sync = options.sync ?? false;
  const [predictions, actions, storylineResult] = await Promise.all([
    loadPredictions(now, sync, prismaClient),
    loadActions(now, sync, prismaClient),
    listStorylines({ limit: 250, sync }),
  ]);

  const storylines = storylineResult.storylines;
  const risingPredictions = predictions.filter((prediction) => prediction.predictionType === 'PROVIDER_TRAJECTORY');
  const shortagePredictions = predictions.filter((prediction) => prediction.predictionType === 'SPECIALTY_PRESSURE');
  const growthPredictions = predictions.filter((prediction) => prediction.predictionType === 'INSTITUTION_MOMENTUM');
  const networkPredictions = predictions.filter((prediction) => prediction.predictionType === 'NETWORK_SHIFT');

  const providerLookup = await loadProviderContext(
    risingPredictions
      .map((prediction) => providerIdFromEntityId(prediction.targetEntity.entityId))
      .filter((value): value is string => Boolean(value)),
    prismaClient,
  );
  const actionLookup = buildActionLookup(actions);
  const providerSignalsByNpi = new Map<string, StrategyProviderSignal>();

  for (const prediction of risingPredictions) {
    const npi = providerIdFromEntityId(prediction.targetEntity.entityId);
    if (!npi) {
      continue;
    }

    const context = providerLookup.get(npi);
    const provider: StrategyEntityRef = {
      entityType: 'provider',
      entityId: npi,
      entityLabel: prediction.targetEntity.entityLabel ?? context?.label ?? `Provider ${npi}`,
    };
    const actionSet = actionSetFor(actionLookup, 'provider', npi);
    providerSignalsByNpi.set(npi, {
      provider,
      specialty: context?.specialty ?? null,
      state: context?.state ?? null,
      institutions: context?.institutions ?? [],
      risingPrediction: prediction,
      marketSignals: [],
      institutionShiftStorylineIds: [],
      networkStorylineIds: [],
      supportingActionIds: actionSet.ids,
      recommendedActions: actionSet.labels,
      publicationGrowth: scaledPositiveSignal(prediction, 'publication_acceleration', 5),
      recentTrialCount: scaledPositiveSignal(prediction, 'trial_leadership_progression', 1),
      recentGrantCount: scaledPositiveSignal(prediction, 'grant_funding_trajectory', 4),
      citationCount: Math.max(
        scaledPositiveSignal(prediction, 'citation_quality_trend', 80),
        Math.round((asNumber(prediction.metadata.positiveSignals) ?? 0) * 25),
      ),
      graphDegree: Math.max(
        scaledPositiveSignal(prediction, 'network_centrality_change', 3),
        Math.round((asNumber(prediction.metadata.positiveSignals) ?? 0) * 2),
      ),
    });
  }

  const institutionSignalMap = new Map<string, StrategyInstitutionSignal>();
  for (const prediction of growthPredictions) {
    const entityId = prediction.targetEntity.entityId;
    const actionSet = actionSetFor(actionLookup, 'institution', entityId);
    institutionSignalMap.set(entityId, {
      institution: {
        entityType: 'institution',
        entityId,
        entityLabel: prediction.targetEntity.entityLabel,
      },
      growthPrediction: prediction,
      linkedRisingProviders: [],
      linkedNetworkCount: 0,
      supportingStorylineIds: [],
      supportingActionIds: actionSet.ids,
      recommendedActions: actionSet.labels,
    });
  }

  for (const storyline of storylines) {
    const providerIds = providerEntityIds(storyline);
    if (storyline.storylineType === 'institution shift') {
      for (const providerId of providerIds) {
        providerSignalsByNpi.get(providerId)?.institutionShiftStorylineIds.push(storyline.storylineId);
      }
    }
    if (storyline.storylineType === 'network emergence') {
      for (const providerId of providerIds) {
        providerSignalsByNpi.get(providerId)?.networkStorylineIds.push(storyline.storylineId);
      }
      for (const institutionId of institutionEntityIds(storyline)) {
        const signal = institutionSignalMap.get(institutionId);
        if (signal) {
          signal.linkedNetworkCount += 1;
          signal.supportingStorylineIds.push(storyline.storylineId);
        }
      }
    }
  }

  const marketSignals: StrategyMarketSignal[] = shortagePredictions.map((prediction) => {
    const scope = parseMarketScope(prediction);
    const actionSet = actionSetFor(actionLookup, 'specialty', scope.entityId);
    const risingProviders = [...providerSignalsByNpi.values()]
      .filter((provider) =>
        slugify(provider.specialty ?? '') === slugify(scope.specialty ?? '')
        && (!scope.geography || provider.state === scope.geography),
      )
      .map((provider) => provider.provider);

    return {
      scope,
      shortagePrediction: prediction,
      pressureScore: pressureScoreForPrediction(prediction),
      demand: marketDemandUnits(prediction),
      supply: marketSupplyUnits(prediction),
      risingProviders,
      recommendedActions: actionSet.labels,
      supportingActionIds: actionSet.ids,
    };
  });

  for (const providerSignal of providerSignalsByNpi.values()) {
    providerSignal.marketSignals = marketSignals.filter((market) =>
      slugify(providerSignal.specialty ?? '') === slugify(market.scope.specialty ?? '')
      && (!market.scope.geography || providerSignal.state === market.scope.geography),
    );

    for (const institution of providerSignal.institutions) {
      const signal = institutionSignalMap.get(institution.entityId);
      if (!signal) {
        continue;
      }

      signal.linkedRisingProviders.push(providerSignal.provider);
      signal.supportingActionIds.push(...providerSignal.supportingActionIds);
      signal.recommendedActions.push(...providerSignal.recommendedActions);
      signal.supportingStorylineIds.push(...providerSignal.networkStorylineIds);
    }
  }

  const networkSignals: StrategyNetworkSignal[] = networkPredictions.map((prediction) => {
    const providerId = providerIdFromEntityId(prediction.targetEntity.entityId);
    const providerSignal = providerId ? providerSignalsByNpi.get(providerId) : undefined;
    const relatedStorylines = storylines.filter((storyline) =>
      storyline.storylineType === 'network emergence'
      && providerIdsMatchStoryline(providerId, storyline),
    );
    const peerEntities = uniqueStrings(
      relatedStorylines.flatMap((storyline) => providerEntityIds(storyline)),
    )
      .filter((candidate) => candidate !== providerId)
      .slice(0, 6)
      .map((candidate) => ({
        entityType: 'provider',
        entityId: candidate,
        entityLabel: providerLookup.get(candidate)?.label ?? `Provider ${candidate}`,
      }));
    const networkId = `network:${prediction.targetEntity.entityId}`;
    const actionSet = actionSetFor(actionLookup, 'network', networkId);

    return {
      network: {
        entityType: 'network',
        entityId: networkId,
        entityLabel: prediction.targetEntity.entityLabel
          ? `Cluster around ${prediction.targetEntity.entityLabel}`
          : `Cluster ${prediction.targetEntity.entityId}`,
        geography: providerSignal?.state ?? null,
        specialty: providerSignal?.specialty ?? null,
      },
      anchorEntity: providerSignal?.provider,
      peerEntities,
      expansionPrediction: prediction,
      supportingStorylineIds: relatedStorylines.map((storyline) => storyline.storylineId),
      supportingActionIds: [...actionSet.ids, ...(providerSignal?.supportingActionIds ?? [])],
      recommendedActions: [...actionSet.labels, ...(providerSignal?.recommendedActions ?? [])],
      specialty: providerSignal?.specialty ?? null,
      geography: providerSignal?.state ?? null,
    };
  });

  const institutionSignals = [...institutionSignalMap.values()].map((signal) => ({
    ...signal,
    linkedRisingProviders: dedupeEntities(signal.linkedRisingProviders),
    supportingStorylineIds: uniqueStrings(signal.supportingStorylineIds),
    supportingActionIds: uniqueStrings(signal.supportingActionIds),
    recommendedActions: uniqueStrings(signal.recommendedActions),
  }));

  const insights = createStrategyEngine().generate({
    providerSignals: [...providerSignalsByNpi.values()],
    institutionSignals,
    marketSignals,
    networkSignals,
    now,
  });

  return {
    insights,
    generatedAt: now,
  };
}

function dedupeEntities(entities: StrategyEntityRef[]): StrategyEntityRef[] {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.entityType}:${entity.entityId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function providerIdsMatchStoryline(
  providerId: string | null,
  storyline: { entityIds: string[] },
): boolean {
  if (!providerId) {
    return false;
  }
  return providerEntityIds(storyline).includes(providerId);
}

function summaryForInsights(insights: StrategyInsight[]) {
  const byType: Record<string, number> = {};
  const byImpactLevel: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const insight of insights) {
    byType[insight.type] = (byType[insight.type] ?? 0) + 1;
    byImpactLevel[insight.impactLevel] = (byImpactLevel[insight.impactLevel] ?? 0) + 1;
    byCategory[insight.category] = (byCategory[insight.category] ?? 0) + 1;
  }

  return { byType, byImpactLevel, byCategory };
}

function matchesEntityType(insight: StrategyInsight, entityType: string): boolean {
  if (insight.scope.entityType === entityType) {
    return true;
  }

  return insight.affectedEntities.some((entity) => entity.entityType === entityType);
}

function normalizeSlug(value: string): string {
  return slugify(value.replace(/^specialty:/, '').replace(/^institution:/, '').replace(/^network:/, ''));
}

function insightMatchesProvider(insight: StrategyInsight, providerId: string): boolean {
  if (insight.scope.entityType === 'provider' && insight.scope.entityId === providerId) {
    return true;
  }

  return insight.affectedEntities.some((entity) =>
    entity.entityType === 'provider' && entity.entityId === providerId,
  );
}

function insightMatchesInstitution(insight: StrategyInsight, institutionId: string): boolean {
  const normalized = normalizeSlug(institutionId);

  if (
    insight.scope.entityType === 'institution'
    && (
      normalizeSlug(insight.scope.entityId) === normalized
      || normalizeSlug(insight.scope.entityLabel ?? '') === normalized
    )
  ) {
    return true;
  }

  return insight.affectedEntities.some((entity) =>
    entity.entityType === 'institution'
      && (
        normalizeSlug(entity.entityId) === normalized
        || normalizeSlug(entity.entityLabel ?? '') === normalized
      ),
  );
}

function insightMatchesSpecialty(insight: StrategyInsight, specialtySlug: string): boolean {
  const normalized = normalizeSlug(specialtySlug);
  if (normalizeSlug(insight.scope.specialty ?? '') === normalized) {
    return true;
  }

  return insight.affectedEntities.some((entity) =>
    entity.entityType === 'specialty'
      && (
        normalizeSlug(entity.entityId) === normalized
        || normalizeSlug(entity.entityLabel ?? '') === normalized
      ),
  );
}

function insightMatchesNetwork(insight: StrategyInsight, networkId: string): boolean {
  const normalized = normalizeSlug(networkId);
  if (insight.scope.entityType === 'network' && normalizeSlug(insight.scope.entityId) === normalized) {
    return true;
  }

  return insight.affectedEntities.some((entity) =>
    entity.entityType === 'network' && normalizeSlug(entity.entityId) === normalized,
  );
}

async function listStrategyInsightsInternal(
  query: StrategyListQuery,
  predicate: (insight: StrategyInsight) => boolean,
  prismaClient: PrismaClient,
): Promise<{
  insights: StrategyInsight[];
  total: number;
  generatedAt: string;
  summary: ReturnType<typeof summaryForInsights>;
}> {
  const built = await buildStrategyInsights({ sync: query.sync }, prismaClient);
  const filtered = built.insights.filter((insight) => {
    if (query.type && insight.type !== query.type) {
      return false;
    }
    if (query.impactLevel && insight.impactLevel !== query.impactLevel) {
      return false;
    }
    if (query.confidence !== undefined && insight.confidence < query.confidence) {
      return false;
    }
    if (query.entityType && !matchesEntityType(insight, query.entityType)) {
      return false;
    }
    return predicate(insight);
  });

  const limited = filtered.slice(0, Math.min(Math.max(query.limit ?? 50, 1), 100));
  return {
    insights: limited,
    total: filtered.length,
    generatedAt: built.generatedAt,
    summary: summaryForInsights(filtered),
  };
}

export async function listStrategyInsights(
  query: StrategyListQuery = {},
  prismaClient: PrismaClient = prisma,
): Promise<{
  insights: StrategyInsight[];
  total: number;
  generatedAt: string;
  summary: ReturnType<typeof summaryForInsights>;
}> {
  return listStrategyInsightsInternal(query, () => true, prismaClient);
}

export async function listProviderStrategyInsights(
  providerId: string,
  query: StrategyListQuery = {},
  prismaClient: PrismaClient = prisma,
) {
  return listStrategyInsightsInternal(query, (insight) => insightMatchesProvider(insight, providerId), prismaClient);
}

export async function listInstitutionStrategyInsights(
  institutionId: string,
  query: StrategyListQuery = {},
  prismaClient: PrismaClient = prisma,
) {
  return listStrategyInsightsInternal(query, (insight) => insightMatchesInstitution(insight, institutionId), prismaClient);
}

export async function listSpecialtyStrategyInsights(
  specialtySlug: string,
  query: StrategyListQuery = {},
  prismaClient: PrismaClient = prisma,
) {
  return listStrategyInsightsInternal(query, (insight) => insightMatchesSpecialty(insight, specialtySlug), prismaClient);
}

export async function listNetworkStrategyInsights(
  networkId: string,
  query: StrategyListQuery = {},
  prismaClient: PrismaClient = prisma,
) {
  return listStrategyInsightsInternal(query, (insight) => insightMatchesNetwork(insight, networkId), prismaClient);
}

function insightSearchText(insight: StrategyInsight): string {
  return normalizeText([
    insight.title,
    insight.summary,
    insight.explanation,
    insight.scope.entityLabel ?? '',
    insight.scope.geography ?? '',
    insight.scope.specialty ?? '',
    insight.type,
    insight.category,
    ...insight.drivers.map((driver) => `${driver.label} ${driver.explanation}`),
    ...insight.affectedEntities.map((entity) => `${entity.entityType} ${entity.entityLabel ?? entity.entityId}`),
  ].join(' '));
}

export async function searchStrategyInsightsForCopilot(input: {
  query: string;
  limit?: number;
  entityType?: string;
  prismaClient?: PrismaClient;
}): Promise<StrategyInsight[]> {
  const prismaClient = input.prismaClient ?? prisma;
  const built = await buildStrategyInsights({ sync: false }, prismaClient);
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);
  const queryText = normalizeText(input.query);

  return built.insights
    .filter((insight) => !input.entityType || matchesEntityType(insight, input.entityType))
    .map((insight) => {
      const lexical = lexicalSimilarity(queryText, insightSearchText(insight));
      const keywordHits = uniqueStrings(queryText.toLowerCase().split(/[^a-z0-9]+/g))
        .filter((keyword) => keyword.length > 2)
        .filter((keyword) => insightSearchText(insight).toLowerCase().includes(keyword))
        .length;
      const score = lexical + Math.min(keywordHits * 0.08, 0.32) + (insight.confidence * 0.18);
      return { insight, score };
    })
    .filter((entry) => entry.score >= 0.16)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.insight);
}

export function strategyInsightToEvidence(insight: StrategyInsight): Array<{
  label: string;
  snippet?: string | null;
  source?: string | null;
}> {
  return [
    ...insight.drivers.slice(0, 3).map((driver) => ({
      label: driver.label,
      snippet: driver.explanation,
      source: driver.source,
    })),
    ...insight.supportingPredictions.slice(0, 2).map((prediction) => ({
      label: prediction.predictionType,
      snippet: prediction.explanation,
      source: 'PREDICTION_ENGINE',
    })),
  ];
}

export function strategyInsightResearchTopics(insight: StrategyInsight): string[] {
  return uniqueStrings([
    insight.scope.specialty,
    insight.type.replace(/_/g, ' '),
    ...insight.drivers.map((driver) => driver.label.replace(/_/g, ' ')),
  ]);
}

export function strategyInsightAffiliations(insight: StrategyInsight): string[] {
  return uniqueStrings(
    insight.affectedEntities
      .filter((entity) => entity.entityType === 'institution')
      .map((entity) => entity.entityLabel ?? entity.entityId),
  );
}

export function strategyInsightState(insight: StrategyInsight): string | undefined {
  return insight.scope.geography ?? undefined;
}

export function strategyInsightInstitution(insight: StrategyInsight): string | undefined {
  if (insight.scope.entityType === 'institution') {
    return insight.scope.entityLabel ?? insight.scope.entityId;
  }

  return insight.affectedEntities.find((entity) => entity.entityType === 'institution')?.entityLabel ?? undefined;
}

export function strategyInsightSpecialty(insight: StrategyInsight): string | undefined {
  return insight.scope.specialty ?? undefined;
}

export function strategyInsightProviderNpi(insight: StrategyInsight): string | undefined {
  if (insight.scope.entityType === 'provider') {
    return insight.scope.entityId;
  }

  return insight.affectedEntities.find((entity) => entity.entityType === 'provider')?.entityId ?? undefined;
}

export function strategyInsightGraphSignals(insight: StrategyInsight): string[] {
  return uniqueStrings([
    ...insight.affectedEntities
      .filter((entity) => entity.entityType === 'network')
      .map((entity) => entity.entityLabel ?? entity.entityId),
    ...insight.drivers
      .filter((driver) => driver.source === 'GRAPH_RUNTIME')
      .map((driver) => driver.explanation),
  ]);
}

export function strategyInsightSourceCoverage(insight: StrategyInsight): string[] {
  return uniqueStrings([
    'STRATEGY_ENGINE',
    ...insight.drivers.map((driver) => driver.source),
    ...insight.supportingPredictions.map((prediction) => 'PREDICTION_ENGINE'),
    ...(insight.supportingStorylineIds.length > 0 ? ['STORYLINE_ENGINE'] : []),
  ]);
}
