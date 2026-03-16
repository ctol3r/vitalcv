import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type {
  InvestigatorRuntimeDescriptor,
  InvestigatorRuntimeDetail,
  InvestigatorRuntimeSummary,
} from './contracts';
import { buildFindingsBusDispatchBundle } from './findingsBus';

const ACTIVE_FINDING_STATUSES = new Set(['new', 'acknowledged', 'investigating']);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const INVESTIGATOR_RUNTIME_DESCRIPTORS: InvestigatorRuntimeDescriptor[] = [
  {
    id: 'sanctions_investigator',
    name: 'Sanctions Investigator',
    purpose: 'Monitors exclusion, sanctions, and adverse regulatory signals and re-checks providers after material affiliation shifts.',
    phases: ['ingest', 'evaluate', 'emit'],
    engineInvestigatorIds: ['sanctions'],
    subscriptions: [
      {
        signalClass: 'sanctions_authority',
        sources: ['OIG_LEIE', 'SAM_GOV', 'NPDB'],
        findingTypes: ['sanctions'],
        storylineTypes: ['compliance risk', 'trust decline'],
        relationshipTypes: ['regulatory', 'institutional'],
      },
      {
        signalClass: 'provider_movement',
        sources: ['NPPES_API', 'INSTITUTION_AFFILIATION'],
        findingTypes: ['workforce_shift', 'institution_expansion'],
        storylineTypes: ['institution shift'],
        relationshipTypes: ['institutional'],
      },
    ],
    cadence: {
      label: 'daily + reactive re-checks',
      triggers: ['scheduled', 'targeted', 'event_ingestion'],
      cadenceMinutes: 1_440,
      suppressionWindowMinutes: 720,
      storylineWindowMinutes: 10_080,
    },
    findingTypes: ['sanctions'],
    confidenceModel: {
      label: 'authority-weighted',
      inputs: ['authoritative source weight', 'cross-source corroboration', 'entity linkage quality', 'recency'],
      formula: '0.45 authority + 0.25 corroboration + 0.15 linkage + 0.15 recency',
      explanation: 'Sanctions confidence is highest when the signal comes from an authoritative regulator and is reinforced by recent affiliation context.',
    },
    storylineMappings: [
      { storylineType: 'compliance risk', rationale: 'Sanctions are direct compliance and access-control risks.' },
      { storylineType: 'trust decline', rationale: 'Confirmed sanctions materially change provider trust posture.' },
    ],
    workingMemoryKeys: ['latest_sanction_source', 'recent_affiliation_changes', 'last_clearance_check'],
    publishes: ['finding.emitted', 'sanctions.recheck.requested'],
    subscribes: ['finding.workforce_shift', 'finding.institution_expansion'],
  },
  {
    id: 'research_momentum',
    name: 'Research Momentum Investigator',
    purpose: 'Measures publication, grant, and collaboration acceleration to identify providers moving into higher research relevance.',
    phases: ['ingest', 'evaluate', 'emit'],
    engineInvestigatorIds: ['research_momentum'],
    subscriptions: [
      {
        signalClass: 'research_output',
        sources: ['OPENALEX', 'PUBMED', 'NIH_REPORTER', 'CLINICAL_TRIALS'],
        findingTypes: ['research_momentum'],
        storylineTypes: ['rising investigator', 'industry influence'],
        relationshipTypes: ['co_author', 'co_investigator', 'institutional'],
      },
      {
        signalClass: 'industry_overlap',
        sources: ['OPEN_PAYMENTS'],
        findingTypes: ['industry_influence'],
        storylineTypes: ['industry influence'],
        relationshipTypes: ['financial'],
      },
    ],
    cadence: {
      label: 'every 6 hours + ingestion driven',
      triggers: ['scheduled', 'targeted', 'event_ingestion'],
      cadenceMinutes: 360,
      suppressionWindowMinutes: 720,
      storylineWindowMinutes: 2_880,
    },
    findingTypes: ['research_momentum'],
    confidenceModel: {
      label: 'trajectory-composite',
      inputs: ['publication velocity', 'trial participation', 'grant evidence', 'network centrality'],
      formula: '0.30 publication + 0.25 trial + 0.25 grant + 0.20 graph',
      explanation: 'Research momentum rises when multiple explainable research channels trend upward together.',
    },
    storylineMappings: [
      { storylineType: 'rising investigator', rationale: 'Research acceleration is the primary indicator for investigator emergence.' },
      { storylineType: 'industry influence', rationale: 'Industry signals enrich the provider’s research trajectory when funders overlap.' },
    ],
    workingMemoryKeys: ['publication_window', 'grant_window', 'trial_window', 'research_peer_baseline'],
    publishes: ['finding.emitted', 'storyline.enrichment.requested'],
    subscribes: ['finding.industry_influence', 'finding.clinical_trial_watch'],
  },
  {
    id: 'industry_influence',
    name: 'Industry Influence Investigator',
    purpose: 'Tracks concentrated payment and sponsor patterns and surfaces explainable financial-network influence signals.',
    phases: ['ingest', 'evaluate', 'emit'],
    engineInvestigatorIds: ['industry_influence'],
    subscriptions: [
      {
        signalClass: 'financial_relationship',
        sources: ['OPEN_PAYMENTS'],
        findingTypes: ['industry_influence'],
        storylineTypes: ['industry influence'],
        relationshipTypes: ['financial', 'corporate'],
      },
      {
        signalClass: 'research_overlap',
        sources: ['CLINICAL_TRIALS', 'OPENALEX'],
        findingTypes: ['research_momentum', 'clinical_trial_watch'],
        storylineTypes: ['rising investigator'],
        relationshipTypes: ['co_investigator', 'co_author'],
      },
    ],
    cadence: {
      label: 'twice daily + ingestion driven',
      triggers: ['scheduled', 'targeted', 'event_ingestion'],
      cadenceMinutes: 720,
      suppressionWindowMinutes: 1_440,
      storylineWindowMinutes: 2_880,
    },
    findingTypes: ['industry_influence'],
    confidenceModel: {
      label: 'concentration-and-cluster',
      inputs: ['payment concentration', 'payer diversity', 'peer cluster size', 'graph centrality'],
      formula: '0.35 concentration + 0.20 payer diversity + 0.20 cluster + 0.25 graph',
      explanation: 'Industry influence depends on concentration, repeated sponsor overlap, and whether the provider sits inside a broader sponsor-linked network.',
    },
    storylineMappings: [
      { storylineType: 'industry influence', rationale: 'The investigator directly populates financial influence storylines.' },
      { storylineType: 'rising investigator', rationale: 'Industry sponsorship can contextualize research-growth narratives.' },
    ],
    workingMemoryKeys: ['dominant_payer_cluster', 'payment_release_window', 'peer_payment_baseline'],
    publishes: ['finding.emitted', 'storyline.enrichment.requested'],
    subscribes: ['finding.research_momentum'],
  },
  {
    id: 'clinical_trial_investigator',
    name: 'Clinical Trial Investigator',
    purpose: 'Tracks active trial participation, principal-investigator roles, and trial-site changes that matter to diligence and network tracing.',
    phases: ['ingest', 'evaluate', 'emit'],
    engineInvestigatorIds: ['clinical_trial'],
    subscriptions: [
      {
        signalClass: 'trial_activity',
        sources: ['CLINICAL_TRIALS', 'NIH_REPORTER'],
        findingTypes: ['clinical_trial'],
        storylineTypes: ['rising investigator', 'network emergence'],
        relationshipTypes: ['co_investigator', 'institutional'],
      },
      {
        signalClass: 'institution_growth',
        sources: ['INSTITUTION_AFFILIATION', 'NPPES_API'],
        findingTypes: ['institution_expansion'],
        storylineTypes: ['institution shift'],
        relationshipTypes: ['institutional'],
      },
    ],
    cadence: {
      label: 'every 12 hours + ingestion driven',
      triggers: ['scheduled', 'targeted', 'event_ingestion'],
      cadenceMinutes: 720,
      suppressionWindowMinutes: 720,
      storylineWindowMinutes: 4_320,
    },
    findingTypes: ['clinical_trial'],
    confidenceModel: {
      label: 'role-and-activity',
      inputs: ['active trial count', 'PI role density', 'institution overlap', 'recency'],
      formula: '0.35 activity + 0.30 PI roles + 0.20 institution overlap + 0.15 recency',
      explanation: 'Trial confidence increases when recent, active, provider-linked roles recur across institutions and sponsors.',
    },
    storylineMappings: [
      { storylineType: 'rising investigator', rationale: 'Sustained trial leadership is a research-trajectory signal.' },
      { storylineType: 'network emergence', rationale: 'Shared trials create reusable collaboration context.' },
    ],
    workingMemoryKeys: ['active_trial_window', 'trial_role_mix', 'trial_site_history'],
    publishes: ['finding.emitted', 'graph.highlight.requested'],
    subscribes: ['finding.institution_expansion', 'finding.research_momentum'],
  },
  {
    id: 'workforce_shift',
    name: 'Workforce Shift Investigator',
    purpose: 'Detects provider movement across states, institutions, and practice footprints so downstream investigators can re-assess trust and organizational impact.',
    phases: ['ingest', 'evaluate', 'emit'],
    engineInvestigatorIds: ['workforce_shift'],
    subscriptions: [
      {
        signalClass: 'practice_change',
        sources: ['NPPES_API', 'PRACTICE_LOCATION', 'INSTITUTION_AFFILIATION'],
        findingTypes: ['workforce_shift'],
        storylineTypes: ['institution shift', 'workforce opportunity'],
        relationshipTypes: ['institutional', 'mentorship'],
      },
      {
        signalClass: 'market_pressure',
        sources: ['WORKFORCE_MODEL', 'NPPES_API'],
        findingTypes: ['workforce_pressure'],
        storylineTypes: ['workforce opportunity'],
        relationshipTypes: ['institutional'],
      },
    ],
    cadence: {
      label: 'twice daily + ingestion driven',
      triggers: ['scheduled', 'targeted', 'event_ingestion'],
      cadenceMinutes: 720,
      suppressionWindowMinutes: 720,
      storylineWindowMinutes: 2_880,
    },
    findingTypes: ['workforce_shift'],
    confidenceModel: {
      label: 'movement-delta',
      inputs: ['location delta', 'institution delta', 'source freshness', 'provider centrality'],
      formula: '0.35 institution delta + 0.30 location delta + 0.20 freshness + 0.15 graph',
      explanation: 'Workforce shift confidence depends on a concrete movement delta that was observed recently in authoritative provider directories.',
    },
    storylineMappings: [
      { storylineType: 'institution shift', rationale: 'Provider movement is the core input to institution-shift narratives.' },
      { storylineType: 'workforce opportunity', rationale: 'High-mobility providers can create staffing opportunity or pressure.' },
    ],
    workingMemoryKeys: ['prior_state', 'prior_institution', 'recent_movement_window'],
    publishes: ['finding.emitted', 'sanctions.recheck.requested'],
    subscribes: ['finding.institution_expansion'],
  },
  {
    id: 'institution_expansion',
    name: 'Institution Expansion Investigator',
    purpose: 'Measures provider-affiliation growth around institutions and emits expansion storylines that can cascade to affiliated providers and trial programs.',
    phases: ['ingest', 'evaluate', 'emit'],
    engineInvestigatorIds: ['institution_expansion'],
    subscriptions: [
      {
        signalClass: 'affiliation_growth',
        sources: ['NPPES_API', 'INSTITUTION_AFFILIATION', 'CLINICAL_TRIALS', 'OPENALEX'],
        findingTypes: ['institution_expansion'],
        storylineTypes: ['institution shift', 'network emergence'],
        relationshipTypes: ['institutional', 'corporate', 'co_author'],
      },
      {
        signalClass: 'provider_movement',
        sources: ['NPPES_API'],
        findingTypes: ['workforce_shift'],
        storylineTypes: ['institution shift'],
        relationshipTypes: ['institutional'],
      },
    ],
    cadence: {
      label: 'daily + reactive to provider shifts',
      triggers: ['scheduled', 'targeted', 'event_ingestion'],
      cadenceMinutes: 1_440,
      suppressionWindowMinutes: 1_440,
      storylineWindowMinutes: 4_320,
    },
    findingTypes: ['institution_expansion'],
    confidenceModel: {
      label: 'cohort-growth',
      inputs: ['net-new affiliated providers', 'prior cohort baseline', 'research overlap', 'recency'],
      formula: '0.35 net new providers + 0.25 baseline delta + 0.20 research overlap + 0.20 recency',
      explanation: 'Institution expansion becomes convincing when provider-affiliation growth is recent, persistent, and reinforced by research or trial spillover.',
    },
    storylineMappings: [
      { storylineType: 'institution shift', rationale: 'Expanding institutions create the strongest institution-shift narratives.' },
      { storylineType: 'network emergence', rationale: 'Expansion often creates new provider clusters and collaboration paths.' },
    ],
    workingMemoryKeys: ['institution_growth_window', 'institution_provider_baseline', 'expansion_outliers'],
    publishes: ['finding.emitted', 'provider.impact.requested'],
    subscribes: ['finding.workforce_shift', 'finding.clinical_trial_watch'],
  },
];

function nextRunAt(lastRunAt: string | null, cadenceMinutes: number): string | null {
  if (!lastRunAt) {
    return null;
  }

  const last = Date.parse(lastRunAt);
  if (!Number.isFinite(last)) {
    return null;
  }

  return new Date(last + (cadenceMinutes * 60_000)).toISOString();
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function listInvestigatorRuntimeDescriptors(): InvestigatorRuntimeDescriptor[] {
  return INVESTIGATOR_RUNTIME_DESCRIPTORS.map((descriptor) => ({
    ...descriptor,
    engineInvestigatorIds: [...descriptor.engineInvestigatorIds],
    subscriptions: descriptor.subscriptions.map((subscription) => ({
      ...subscription,
      sources: [...subscription.sources],
      findingTypes: subscription.findingTypes ? [...subscription.findingTypes] : undefined,
      storylineTypes: subscription.storylineTypes ? [...subscription.storylineTypes] : undefined,
      relationshipTypes: subscription.relationshipTypes ? [...subscription.relationshipTypes] : undefined,
    })),
    findingTypes: [...descriptor.findingTypes],
    storylineMappings: descriptor.storylineMappings.map((mapping) => ({ ...mapping })),
    workingMemoryKeys: [...descriptor.workingMemoryKeys],
    publishes: [...descriptor.publishes],
    subscribes: [...descriptor.subscribes],
  }));
}

export function getInvestigatorRuntimeDescriptor(id: string): InvestigatorRuntimeDescriptor | null {
  return listInvestigatorRuntimeDescriptors().find((descriptor) => descriptor.id === id) ?? null;
}

async function loadRuntimeAggregates(
  prismaClient: PrismaClient,
): Promise<{
  lastRunAtByInvestigator: Map<string, string>;
  activeFindingCountByInvestigator: Map<string, number>;
  recentFindingCountByInvestigator: Map<string, number>;
  avgConfidenceByInvestigator: Map<string, number>;
  reviewedByInvestigator: Map<string, number>;
  falsePositiveRateByInvestigator: Map<string, number>;
}> {
  const engineIds = dedupe(INVESTIGATOR_RUNTIME_DESCRIPTORS.flatMap((descriptor) => descriptor.engineInvestigatorIds));
  const [runRows, findingRows, learningRows] = await Promise.all([
    prismaClient.investigatorRunLog.findMany({
      where: {
        investigatorId: { in: engineIds },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        investigatorId: true,
        startedAt: true,
      },
      take: 200,
    }),
    prismaClient.investigatorFinding.findMany({
      where: {
        investigatorId: { in: engineIds },
      },
      select: {
        investigatorId: true,
        status: true,
        confidence: true,
        lastSeenAt: true,
      },
    }),
    prismaClient.learningEvent.findMany({
      where: {
        sourceId: { in: engineIds },
        subjectType: 'INVESTIGATOR_FINDING',
      },
      select: {
        sourceId: true,
        status: true,
      },
      take: 2_000,
      orderBy: { occurredAt: 'desc' },
    }).catch(() => []),
  ]);

  const lastRunAtByInvestigator = new Map<string, string>();
  for (const row of runRows) {
    if (!lastRunAtByInvestigator.has(row.investigatorId)) {
      lastRunAtByInvestigator.set(row.investigatorId, row.startedAt.toISOString());
    }
  }

  const activeFindingCountByInvestigator = new Map<string, number>();
  const recentFindingCountByInvestigator = new Map<string, number>();
  const confidenceAccumulator = new Map<string, { total: number; count: number }>();
  const now = Date.now();

  for (const row of findingRows) {
    if (ACTIVE_FINDING_STATUSES.has(row.status)) {
      activeFindingCountByInvestigator.set(
        row.investigatorId,
        (activeFindingCountByInvestigator.get(row.investigatorId) ?? 0) + 1,
      );
    }

    if ((now - row.lastSeenAt.getTime()) <= THIRTY_DAYS_MS) {
      recentFindingCountByInvestigator.set(
        row.investigatorId,
        (recentFindingCountByInvestigator.get(row.investigatorId) ?? 0) + 1,
      );
    }

    const bucket = confidenceAccumulator.get(row.investigatorId) ?? { total: 0, count: 0 };
    bucket.total += row.confidence;
    bucket.count += 1;
    confidenceAccumulator.set(row.investigatorId, bucket);
  }

  const avgConfidenceByInvestigator = new Map<string, number>();
  for (const [investigatorId, bucket] of confidenceAccumulator.entries()) {
    avgConfidenceByInvestigator.set(investigatorId, bucket.count > 0 ? bucket.total / bucket.count : 0);
  }

  const reviewedByInvestigator = new Map<string, number>();
  const falsePositiveCountByInvestigator = new Map<string, number>();
  for (const row of learningRows) {
    const investigatorId = row.sourceId ?? '';
    if (!investigatorId) {
      continue;
    }

    reviewedByInvestigator.set(
      investigatorId,
      (reviewedByInvestigator.get(investigatorId) ?? 0) + 1,
    );
    if (typeof row.status === 'string' && row.status.startsWith('false_positive_')) {
      falsePositiveCountByInvestigator.set(
        investigatorId,
        (falsePositiveCountByInvestigator.get(investigatorId) ?? 0) + 1,
      );
    }
  }

  const falsePositiveRateByInvestigator = new Map<string, number>();
  for (const [investigatorId, reviewed] of reviewedByInvestigator.entries()) {
    falsePositiveRateByInvestigator.set(
      investigatorId,
      reviewed > 0 ? (falsePositiveCountByInvestigator.get(investigatorId) ?? 0) / reviewed : 0,
    );
  }

  return {
    lastRunAtByInvestigator,
    activeFindingCountByInvestigator,
    recentFindingCountByInvestigator,
    avgConfidenceByInvestigator,
    reviewedByInvestigator,
    falsePositiveRateByInvestigator,
  };
}

function summarizeDescriptor(
  descriptor: InvestigatorRuntimeDescriptor,
  aggregates: Awaited<ReturnType<typeof loadRuntimeAggregates>>,
): InvestigatorRuntimeSummary {
  const activeFindingCount = descriptor.engineInvestigatorIds.reduce((sum, investigatorId) => (
    sum + (aggregates.activeFindingCountByInvestigator.get(investigatorId) ?? 0)
  ), 0);
  const recentFindingCount = descriptor.engineInvestigatorIds.reduce((sum, investigatorId) => (
    sum + (aggregates.recentFindingCountByInvestigator.get(investigatorId) ?? 0)
  ), 0);
  const lastRunAt = descriptor.engineInvestigatorIds
    .map((investigatorId) => aggregates.lastRunAtByInvestigator.get(investigatorId) ?? null)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
  const confidenceValues = descriptor.engineInvestigatorIds
    .map((investigatorId) => aggregates.avgConfidenceByInvestigator.get(investigatorId))
    .filter((value): value is number => typeof value === 'number');
  const avgConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 0;
  const reviewed = descriptor.engineInvestigatorIds.reduce((sum, investigatorId) => (
    sum + (aggregates.reviewedByInvestigator.get(investigatorId) ?? 0)
  ), 0);
  const falsePositiveRate = descriptor.engineInvestigatorIds
    .map((investigatorId) => aggregates.falsePositiveRateByInvestigator.get(investigatorId))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    descriptor,
    activeFindingCount,
    recentFindingCount,
    lastRunAt,
    nextRunAt: nextRunAt(lastRunAt, descriptor.cadence.cadenceMinutes),
    avgConfidence,
    learning: {
      reviewed,
      falsePositiveRate: falsePositiveRate.length > 0
        ? falsePositiveRate.reduce((sum, value) => sum + value, 0) / falsePositiveRate.length
        : 0,
    },
  };
}

export async function listInvestigatorRuntimeSummaries(
  prismaClient: PrismaClient = prisma,
): Promise<InvestigatorRuntimeSummary[]> {
  const aggregates = await loadRuntimeAggregates(prismaClient);
  return listInvestigatorRuntimeDescriptors().map((descriptor) => summarizeDescriptor(descriptor, aggregates));
}

export async function getInvestigatorRuntimeDetail(
  id: string,
  prismaClient: PrismaClient = prisma,
): Promise<InvestigatorRuntimeDetail | null> {
  const descriptor = getInvestigatorRuntimeDescriptor(id);
  if (!descriptor) {
    return null;
  }

  const aggregates = await loadRuntimeAggregates(prismaClient);
  const summary = summarizeDescriptor(descriptor, aggregates);
  const recentFindings = await prismaClient.investigatorFinding.findMany({
    where: {
      investigatorId: { in: descriptor.engineInvestigatorIds },
    },
    orderBy: { updatedAt: 'desc' },
    take: 12,
    include: {
      entityLinks: true,
    },
  });

  return {
    ...summary,
    recentFindings: recentFindings.map((finding) => ({
      findingId: finding.findingId,
      investigatorId: finding.investigatorId,
      findingType: finding.findingType,
      scope: finding.scope as InvestigatorRuntimeDetail['recentFindings'][number]['scope'],
      severity: finding.severity as InvestigatorRuntimeDetail['recentFindings'][number]['severity'],
      title: finding.title,
      summary: finding.summary,
      entityIds: [...finding.entityIds],
      entities: finding.entityLinks.map((entity) => ({
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityLabel: entity.entityLabel,
        relationship: entity.relationship,
        metadata: entity.metadata as Record<string, unknown>,
      })),
      supportingEvidence: [],
      confidence: finding.confidence,
      explanation: finding.explanation,
      status: finding.status as InvestigatorRuntimeDetail['recentFindings'][number]['status'],
      createdAt: finding.createdAt.toISOString(),
      updatedAt: finding.updatedAt.toISOString(),
      firstSeenAt: finding.firstSeenAt.toISOString(),
      lastSeenAt: finding.lastSeenAt.toISOString(),
      occurrenceCount: finding.occurrenceCount,
      priorityScore: finding.priorityScore,
      scoreSignals: {
        confidence: finding.confidence,
        trustImpact: finding.trustImpact,
        freshness: finding.freshness,
        novelty: finding.novelty,
        entityImportance: finding.entityImportance,
        graphCentrality: finding.graphCentrality,
      },
      rankBreakdown: {
        severity: 0,
        confidence: 0,
        trustImpact: 0,
        freshness: 0,
        novelty: 0,
        entityImportance: 0,
        graphCentrality: 0,
        total: 0,
        weights: {
          severity: 0,
          confidence: 0,
          trustImpact: 0,
          freshness: 0,
          novelty: 0,
          entityImportance: 0,
          graphCentrality: 0,
        },
      },
      audienceRoles: [...finding.audienceRoles] as InvestigatorRuntimeDetail['recentFindings'][number]['audienceRoles'],
      metadata: finding.metadata as Record<string, unknown>,
      dedupeKey: finding.dedupeKey,
      storylineKey: finding.storylineKey,
    })),
    recentBusEvents: recentFindings.map((finding) => buildFindingsBusDispatchBundle({
      findingId: finding.findingId,
      investigatorId: finding.investigatorId,
      findingType: finding.findingType,
      scope: finding.scope as InvestigatorRuntimeDetail['recentFindings'][number]['scope'],
      severity: finding.severity as InvestigatorRuntimeDetail['recentFindings'][number]['severity'],
      title: finding.title,
      summary: finding.summary,
      entityIds: [...finding.entityIds],
      entities: finding.entityLinks.map((entity) => ({
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityLabel: entity.entityLabel,
        relationship: entity.relationship,
        metadata: entity.metadata as Record<string, unknown>,
      })),
      supportingEvidence: [],
      confidence: finding.confidence,
      explanation: finding.explanation,
      status: finding.status as InvestigatorRuntimeDetail['recentFindings'][number]['status'],
      createdAt: finding.createdAt.toISOString(),
      updatedAt: finding.updatedAt.toISOString(),
      firstSeenAt: finding.firstSeenAt.toISOString(),
      lastSeenAt: finding.lastSeenAt.toISOString(),
      occurrenceCount: finding.occurrenceCount,
      priorityScore: finding.priorityScore,
      scoreSignals: {
        confidence: finding.confidence,
        trustImpact: finding.trustImpact,
        freshness: finding.freshness,
        novelty: finding.novelty,
        entityImportance: finding.entityImportance,
        graphCentrality: finding.graphCentrality,
      },
      rankBreakdown: {
        severity: 0,
        confidence: 0,
        trustImpact: 0,
        freshness: 0,
        novelty: 0,
        entityImportance: 0,
        graphCentrality: 0,
        total: 0,
        weights: {
          severity: 0,
          confidence: 0,
          trustImpact: 0,
          freshness: 0,
          novelty: 0,
          entityImportance: 0,
          graphCentrality: 0,
        },
      },
      audienceRoles: [...finding.audienceRoles] as InvestigatorRuntimeDetail['recentFindings'][number]['audienceRoles'],
      metadata: finding.metadata as Record<string, unknown>,
      dedupeKey: finding.dedupeKey,
      storylineKey: finding.storylineKey,
    })),
  };
}
