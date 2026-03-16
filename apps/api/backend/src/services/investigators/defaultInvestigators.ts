import type {
  ClaimRecord,
  GraphEdge,
  GraphNode,
  PrismaClient,
  TrustScoreHistory,
  VerificationArtifact,
} from '@prisma/client';
import type {
  FindingEntityLink,
  FindingEvidence,
  InvestigatorDefinition,
  InvestigatorFindingDraft,
} from '../../../../../../core/investigators/investigatorTypes';
import { buildAutonomousInvestigatorDefinitions } from './autonomousInvestigatorEngine';
import { createGraphNodeId } from '../graph-engine/ids';
import { detectDivergence } from '../identity/divergenceEngine';
import { computeTrustFreshness } from '../identity/freshnessModel';

export interface BackendInvestigatorDependencies {
  prisma: PrismaClient;
}

type ProviderContext = {
  npi: string;
  label: string;
  specialty: string | null;
  state: string | null;
  institutions: string[];
  graphDegree: number;
  graphCentrality: number;
};

type IndustryStats = {
  npi: string;
  totalAmount: number;
  recordCount: number;
  year: number | null;
  dominantPayer: string | null;
  dominantPayerAmount: number;
  uniquePayerCount: number;
};

const NPI_RE = /^\d{10}$/;
const COLLABORATION_EDGE_TYPES = ['co_author', 'co_pi', 'co_investigator', 'published_with', 'related_to'];
const RESEARCH_SOURCES = ['OPENALEX', 'PUBMED', 'CLINICAL_TRIALS', 'NIH_REPORTER'];

function simpleHash(input: string): string {
  let hash = 0;
  for (const char of input) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function daysAgo(nowIso: string, days: number): Date {
  return new Date(new Date(nowIso).getTime() - (days * 86_400_000));
}

function recencyScore(nowIso: string, dates: Array<Date | string | null | undefined>): number {
  const newest = dates
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => value instanceof Date ? value.getTime() : new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0];

  if (!newest) {
    return 0.35;
  }

  const ageDays = Math.max(0, (new Date(nowIso).getTime() - newest) / 86_400_000);
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.85;
  if (ageDays <= 90) return 0.7;
  if (ageDays <= 180) return 0.55;
  return 0.35;
}

function cleanName(parts: Array<string | null | undefined>): string | null {
  const value = parts.filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(' ').trim();
  return value.length > 0 ? value : null;
}

function clinicianNodeIdForNpi(npi: string): string {
  return createGraphNodeId({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: npi,
  });
}

function extractSpecialty(value: unknown): string | null {
  const record = asRecord(value);
  return asString(record.specialty)
    ?? asString(record.taxonomy)
    ?? asString(record.primarySpecialty)
    ?? asString(record.title);
}

function extractState(value: unknown): string | null {
  const record = asRecord(value);
  const state = asString(record.state)
    ?? asString(record.stateCode)
    ?? asString(record.practiceState)
    ?? asString(record.licenseState);
  return state ? state.toUpperCase() : null;
}

function extractInstitution(value: unknown): string | null {
  const record = asRecord(value);
  return asString(record.institution)
    ?? asString(record.organization)
    ?? asString(record.affiliation)
    ?? asString(record.employer);
}

function extractCitationCount(value: unknown): number {
  return asNumber(asRecord(value).citationCount) ?? 0;
}

function providerEntity(npi: string, label: string): FindingEntityLink {
  return {
    entityType: 'provider',
    entityId: npi,
    entityLabel: label,
    relationship: 'subject',
  };
}

function institutionEntity(name: string): FindingEntityLink {
  return {
    entityType: 'institution',
    entityId: `institution:${name.toLowerCase().replace(/\s+/g, '-')}`,
    entityLabel: name,
    relationship: 'related',
  };
}

function claimEvidence(claim: Pick<ClaimRecord, 'id' | 'claimType' | 'sourceId' | 'createdAt' | 'value'>, snippet: string): FindingEvidence {
  return {
    evidenceId: `claim_${simpleHash(`${claim.id}:${snippet}`)}`,
    evidenceType: 'claim_record',
    sourceId: claim.sourceId,
    sourceLabel: claim.sourceId,
    recordType: 'claim_record',
    recordId: claim.id,
    observedAt: claim.createdAt.toISOString(),
    snippet,
    metadata: {
      claimType: claim.claimType,
      value: claim.value,
    },
  };
}

function artifactEvidence(artifact: Pick<VerificationArtifact, 'id' | 'source' | 'verifiedAt' | 'rawPayload'>, snippet: string): FindingEvidence {
  return {
    evidenceId: `artifact_${simpleHash(`${artifact.id}:${snippet}`)}`,
    evidenceType: 'verification_artifact',
    sourceId: artifact.source,
    sourceLabel: artifact.source,
    recordType: 'verification_artifact',
    recordId: artifact.id,
    observedAt: artifact.verifiedAt.toISOString(),
    snippet,
    metadata: {
      rawPayload: artifact.rawPayload,
    },
  };
}

function historyEvidence(history: Pick<TrustScoreHistory, 'id' | 'recordedAt' | 'newScore' | 'scoreDelta' | 'band' | 'metadata'>, snippet: string): FindingEvidence {
  return {
    evidenceId: `history_${simpleHash(`${history.id}:${snippet}`)}`,
    evidenceType: 'trust_score_history',
    sourceId: 'TRUST_SCORE_V1',
    sourceLabel: 'TRUST_SCORE_V1',
    recordType: 'trust_score_history',
    recordId: history.id,
    observedAt: history.recordedAt.toISOString(),
    snippet,
    metadata: {
      score: history.newScore,
      scoreDelta: history.scoreDelta,
      band: history.band,
      history: history.metadata,
    },
  };
}

function graphEvidence(
  edge: Pick<GraphEdge, 'id' | 'edgeType' | 'createdAt' | 'confidence'>,
  snippet: string,
): FindingEvidence {
  return {
    evidenceId: `graph_${simpleHash(`${edge.id}:${snippet}`)}`,
    evidenceType: 'graph_edge',
    sourceId: 'GRAPH_RUNTIME',
    sourceLabel: 'GRAPH_RUNTIME',
    recordType: 'graph_edge',
    recordId: edge.id,
    observedAt: edge.createdAt.toISOString(),
    snippet,
    metadata: {
      edgeType: edge.edgeType,
      confidence: edge.confidence,
    },
  };
}

async function loadProviderContext(prisma: PrismaClient, npi: string): Promise<ProviderContext> {
  const [profile, graphNode, claims] = await Promise.all([
    prisma.personProfile.findFirst({
      where: { npi },
      select: {
        firstName: true,
        lastName: true,
        specialty: true,
        stateOfPractice: true,
      },
    }),
    prisma.graphNode.findUnique({
      where: { id: clinicianNodeIdForNpi(npi) },
      select: {
        label: true,
        degree: true,
        metadata: true,
      },
    }),
    prisma.claimRecord.findMany({
      where: {
        subjectNpi: npi,
        claimType: { in: ['SPECIALTY', 'PRACTICE_LOCATION', 'INSTITUTION_AFFILIATION'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        claimType: true,
        value: true,
      },
    }),
  ]);

  const specialtyClaim = claims.find((claim) => claim.claimType === 'SPECIALTY' && extractSpecialty(claim.value));
  const specialty = profile?.specialty ?? extractSpecialty(specialtyClaim?.value);
  const state = profile?.stateOfPractice?.toUpperCase()
    ?? extractState(claims.find((claim) => claim.claimType === 'PRACTICE_LOCATION')?.value);
  const institutions = [...new Set(
    claims
      .filter((claim) => claim.claimType === 'INSTITUTION_AFFILIATION')
      .map((claim) => extractInstitution(claim.value))
      .filter((value): value is string => Boolean(value)),
  )];
  const metadata = asRecord(graphNode?.metadata);
  const label = cleanName([profile?.firstName ?? null, profile?.lastName ?? null])
    ?? asString(metadata.fullName)
    ?? graphNode?.label
    ?? `Provider ${npi}`;

  return {
    npi,
    label,
    specialty: specialty ?? extractSpecialty(metadata),
    state: state ?? extractState(metadata),
    institutions,
    graphDegree: graphNode?.degree ?? 0,
    graphCentrality: clamp01((graphNode?.degree ?? 0) / 12, 0.25),
  };
}

function resolveTargetNpis(targetEntityIds: string[]): string[] {
  return [...new Set(targetEntityIds.filter((entityId) => NPI_RE.test(entityId)))];
}

function dimensionSnapshot(metadata: unknown): Record<string, { score: number; status: string | null; max: number | null }> {
  const scores = asRecord(asRecord(metadata).dimensionScores);
  return Object.fromEntries(
    Object.entries(scores).map(([key, value]) => {
      const record = asRecord(value);
      return [key, {
        score: asNumber(record.score) ?? 0,
        status: asString(record.status),
        max: asNumber(record.max),
      }];
    }),
  );
}

function detectDimensionDrops(previousMetadata: unknown, latestMetadata: unknown): Array<{ dimension: string; delta: number; status: string | null }> {
  const previous = dimensionSnapshot(previousMetadata);
  const latest = dimensionSnapshot(latestMetadata);
  return Object.keys({ ...previous, ...latest })
    .map((dimension) => {
      const previousScore = previous[dimension]?.score ?? 0;
      const latestScore = latest[dimension]?.score ?? 0;
      return {
        dimension,
        delta: previousScore - latestScore,
        status: latest[dimension]?.status ?? null,
      };
    })
    .filter((entry) => entry.delta > 0.5)
    .sort((left, right) => right.delta - left.delta);
}

async function selectTrustDeclineNpis(prisma: PrismaClient, nowIso: string, batchSize: number, targetNpis: string[]): Promise<string[]> {
  if (targetNpis.length > 0) {
    return targetNpis;
  }

  const rows = await prisma.trustScoreHistory.findMany({
    where: {
      subjectType: 'NPI',
      scoreDelta: { lte: -5 },
      recordedAt: { gte: daysAgo(nowIso, 21) },
    },
    orderBy: { recordedAt: 'desc' },
    select: { subjectId: true },
    take: batchSize * 3,
  });

  return [...new Set(rows.map((row) => row.subjectId))].slice(0, batchSize);
}

function bandValue(band: string | null): number {
  if (band === 'L3') return 3;
  if (band === 'L2') return 2;
  if (band === 'L1') return 1;
  return 0;
}

function trustDeclineTitle(provider: ProviderContext, drop: number): string {
  return `${provider.label} trust score dropped ${drop.toFixed(1)} points`;
}

async function buildTrustDeclineFindings(
  prisma: PrismaClient,
  nowIso: string,
  batchSize: number,
  targetNpis: string[],
  markCovered: (entityId: string) => void,
): Promise<InvestigatorFindingDraft[]> {
  const npis = await selectTrustDeclineNpis(prisma, nowIso, batchSize, targetNpis);
  const findings: InvestigatorFindingDraft[] = [];

  for (const npi of npis) {
    markCovered(npi);
    const [history, provider] = await Promise.all([
      prisma.trustScoreHistory.findMany({
        where: {
          subjectType: 'NPI',
          subjectId: npi,
        },
        orderBy: { recordedAt: 'desc' },
        take: 2,
      }),
      loadProviderContext(prisma, npi),
    ]);

    if (history.length < 2) {
      continue;
    }

    const latest = history[0]!;
    const previous = history[1]!;
    const drop = Math.abs(Math.min(0, latest.scoreDelta ?? previous.newScore - latest.newScore));
    if (drop < 5) {
      continue;
    }

    const bandDrop = bandValue(previous.band ?? null) - bandValue(latest.band ?? null);
    const dimensionDrops = detectDimensionDrops(previous.metadata, latest.metadata).slice(0, 3);
    const topDimensions = dimensionDrops.map((entry) => `${entry.dimension} (-${entry.delta.toFixed(1)})`);
    const severity = drop >= 20 || bandDrop >= 2
      ? 'critical'
      : drop >= 10
        ? 'high'
        : 'medium';

    findings.push({
      findingType: 'trust_decline',
      severity,
      title: trustDeclineTitle(provider, drop),
      summary: `${provider.label} moved from ${previous.newScore.toFixed(1)} (${previous.band ?? 'L0'}) to ${latest.newScore.toFixed(1)} (${latest.band ?? 'L0'}). ${topDimensions.length > 0 ? `Primary drivers: ${topDimensions.join(', ')}.` : 'The latest trust snapshot carries a materially lower score.'}`,
      entityIds: [npi],
      entities: [
        providerEntity(npi, provider.label),
        ...provider.institutions.slice(0, 2).map((institution) => institutionEntity(institution)),
      ],
      supportingEvidence: [
        historyEvidence(previous, `Previous trust score ${previous.newScore.toFixed(1)} (${previous.band ?? 'L0'}).`),
        historyEvidence(latest, `Latest trust score ${latest.newScore.toFixed(1)} (${latest.band ?? 'L0'}) with delta ${latest.scoreDelta.toFixed(1)}.`),
      ],
      confidence: 0.94,
      explanation: `${provider.label} triggered a trust decline finding because the latest trust history entry recorded a ${drop.toFixed(1)} point drop. ${topDimensions.length > 0 ? `The largest dimension changes were ${topDimensions.join(', ')}.` : 'Dimension-level metadata was not fully available, so the decline is anchored to the recorded score delta.'}`,
      dedupeKey: `trust_decline:${npi}`,
      storylineKey: `trust_decline:${npi}`,
      scoreSignals: {
        trustImpact: clamp01(drop / 25),
        freshness: recencyScore(nowIso, [latest.recordedAt]),
        novelty: 1,
        entityImportance: clamp01(0.45 + provider.graphCentrality),
        graphCentrality: provider.graphCentrality,
      },
      metadata: {
        npi,
        previousScore: previous.newScore,
        latestScore: latest.newScore,
        scoreDelta: latest.scoreDelta,
        previousBand: previous.band,
        latestBand: latest.band,
        dimensionDrivers: dimensionDrops,
      },
    });
  }

  return findings;
}

async function selectResearchMomentumNpis(prisma: PrismaClient, nowIso: string, batchSize: number, targetNpis: string[]): Promise<string[]> {
  if (targetNpis.length > 0) {
    return targetNpis;
  }

  const rows = await prisma.claimRecord.findMany({
    where: {
      sourceId: { in: RESEARCH_SOURCES },
      createdAt: { gte: daysAgo(nowIso, 365) },
    },
    orderBy: { createdAt: 'desc' },
    select: { subjectNpi: true },
    take: batchSize * 6,
  });

  return [...new Set(rows.map((row) => row.subjectNpi))].slice(0, batchSize);
}

async function buildResearchMomentumFindings(
  prisma: PrismaClient,
  nowIso: string,
  batchSize: number,
  targetNpis: string[],
  markCovered: (entityId: string) => void,
): Promise<InvestigatorFindingDraft[]> {
  const npis = await selectResearchMomentumNpis(prisma, nowIso, batchSize, targetNpis);
  const findings: InvestigatorFindingDraft[] = [];

  for (const npi of npis) {
    markCovered(npi);
    const [claims, provider] = await Promise.all([
      prisma.claimRecord.findMany({
        where: {
          subjectNpi: npi,
          sourceId: { in: RESEARCH_SOURCES },
          createdAt: { gte: daysAgo(nowIso, 365) },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      loadProviderContext(prisma, npi),
    ]);

    if (claims.length === 0) {
      continue;
    }

    const recentCutoff = daysAgo(nowIso, 180);
    const previousCutoff = daysAgo(nowIso, 365);
    const recent = claims.filter((claim) => claim.createdAt >= recentCutoff);
    const previous = claims.filter((claim) => claim.createdAt < recentCutoff && claim.createdAt >= previousCutoff);
    const recentPublicationCount = recent.filter((claim) => ['PUBLICATION', 'CITATION_METRIC'].includes(claim.claimType)).length;
    const previousPublicationCount = previous.filter((claim) => ['PUBLICATION', 'CITATION_METRIC'].includes(claim.claimType)).length;
    const recentTrialCount = recent.filter((claim) => claim.claimType === 'CLINICAL_TRIAL').length;
    const recentGrantCount = recent.filter((claim) => claim.sourceId === 'NIH_REPORTER' || claim.claimType.includes('GRANT')).length;
    const citationCount = Math.max(0, ...recent.map((claim) => extractCitationCount(claim.value)));
    const publicationAcceleration = recentPublicationCount >= Math.max(2, previousPublicationCount + 2);
    const thoughtLeaderSignal = citationCount >= 100 || (recentPublicationCount >= 3 && recentTrialCount >= 1) || provider.graphDegree >= 8;

    if (!publicationAcceleration && recentTrialCount === 0 && recentGrantCount === 0) {
      continue;
    }

    const severity = recentGrantCount >= 2 || (thoughtLeaderSignal && recentTrialCount >= 1)
      ? 'high'
      : 'medium';

    findings.push({
      findingType: 'research_momentum',
      severity,
      title: `${provider.label} shows accelerating research momentum`,
      summary: `${provider.label} logged ${recentPublicationCount} research-publication signals and ${recentTrialCount} recent trial-role signals in the last 180 days${recentGrantCount > 0 ? `, plus ${recentGrantCount} grant-linked records` : ''}. ${thoughtLeaderSignal ? 'The combined publication/trial footprint suggests emerging thought-leader status.' : 'Research activity is rising against the previous 180-day window.'}`,
      entityIds: [npi],
      entities: [providerEntity(npi, provider.label)],
      supportingEvidence: recent.slice(0, 5).map((claim) => claimEvidence(
        claim,
        `${claim.claimType} from ${claim.sourceId} on ${claim.createdAt.toISOString().slice(0, 10)}`,
      )),
      confidence: thoughtLeaderSignal ? 0.82 : 0.74,
      explanation: `${provider.label} was flagged because research-linked claims accelerated relative to the prior 180-day period. These signals rely on external research sources, so the finding is intelligence-grade rather than a trust-enforcement decision.`,
      dedupeKey: `research_momentum:${npi}`,
      storylineKey: `research_momentum:${npi}`,
      scoreSignals: {
        trustImpact: clamp01((recentTrialCount * 0.18) + (recentGrantCount * 0.22) + (publicationAcceleration ? 0.2 : 0)),
        freshness: recencyScore(nowIso, recent.map((claim) => claim.createdAt)),
        novelty: previousPublicationCount === 0 ? 1 : clamp01(recentPublicationCount / Math.max(1, previousPublicationCount * 2), 0.7),
        entityImportance: clamp01((citationCount / 200) + provider.graphCentrality, 0.45),
        graphCentrality: provider.graphCentrality,
      },
      metadata: {
        npi,
        recentPublicationCount,
        previousPublicationCount,
        recentTrialCount,
        recentGrantCount,
        citationCount,
        thoughtLeaderSignal,
      },
    });
  }

  return findings;
}

async function detectInstitutionMismatch(prisma: PrismaClient, npi: string): Promise<{
  names: string[];
  claims: Array<Pick<ClaimRecord, 'id' | 'claimType' | 'sourceId' | 'createdAt' | 'value'>>;
} | null> {
  const claims = await prisma.claimRecord.findMany({
    where: {
      subjectNpi: npi,
      claimType: 'INSTITUTION_AFFILIATION',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      claimType: true,
      sourceId: true,
      createdAt: true,
      value: true,
    },
  });

  const names = [...new Set(
    claims
      .map((claim) => extractInstitution(claim.value))
      .filter((value): value is string => Boolean(value)),
  )];

  return names.length >= 2 ? { names, claims } : null;
}

async function selectDivergenceNpis(prisma: PrismaClient, nowIso: string, batchSize: number, targetNpis: string[]): Promise<string[]> {
  if (targetNpis.length > 0) {
    return targetNpis;
  }

  const [anomalies, trustDrops] = await Promise.all([
    prisma.anomalyHistory.findMany({
      where: {
        subjectType: 'NPI',
        status: 'OPEN',
        lastDetectedAt: { gte: daysAgo(nowIso, 30) },
      },
      orderBy: { lastDetectedAt: 'desc' },
      select: { subjectId: true },
      take: batchSize * 3,
    }),
    prisma.sourceRun.findMany({
      where: {
        createdAt: { gte: daysAgo(nowIso, 14) },
      },
      orderBy: { createdAt: 'desc' },
      select: { subjectNpi: true },
      take: batchSize * 3,
    }),
  ]);

  return [...new Set([
    ...anomalies.map((row) => row.subjectId),
    ...trustDrops.map((row) => row.subjectNpi),
  ])].slice(0, batchSize);
}

async function buildDivergenceFindings(
  prisma: PrismaClient,
  nowIso: string,
  batchSize: number,
  targetNpis: string[],
  markCovered: (entityId: string) => void,
): Promise<InvestigatorFindingDraft[]> {
  const npis = await selectDivergenceNpis(prisma, nowIso, batchSize, targetNpis);
  const findings: InvestigatorFindingDraft[] = [];

  for (const npi of npis) {
    markCovered(npi);
    const [report, freshness, provider, institutionMismatch] = await Promise.all([
      detectDivergence(npi),
      computeTrustFreshness(npi),
      loadProviderContext(prisma, npi),
      detectInstitutionMismatch(prisma, npi),
    ]);

    const staleSignals = freshness.staleDimensions.filter((dimension) => dimension.sources.length > 0);
    if (report.conflicts.length === 0 && !institutionMismatch && staleSignals.length === 0) {
      continue;
    }

    const conflictSnippets = report.conflicts.slice(0, 3).map((conflict) => conflict.description);
    const staleSnippet = staleSignals.slice(0, 2).map((dimension) => `${dimension.claimClass} is ${Math.round(dimension.ageHours)}h old`);
    const institutionSnippet = institutionMismatch
      ? [`Institution mismatch across ${institutionMismatch.names.join(' vs ')}`]
      : [];

    const severity = report.hasBlocking || (institutionMismatch?.names.length ?? 0) >= 3
      ? 'critical'
      : report.conflicts.some((conflict) => conflict.severity === 'MODERATE') || staleSignals.length > 0
        ? 'high'
        : 'medium';

    const supportingEvidence: FindingEvidence[] = [
      ...report.conflicts.slice(0, 4).map((conflict) => ({
        evidenceId: `divergence_${conflict.id}`,
        evidenceType: 'divergence_conflict',
        sourceId: conflict.sources[0] ?? null,
        sourceLabel: conflict.sources.join(', '),
        recordType: 'divergence_conflict',
        recordId: conflict.id,
        observedAt: conflict.detectedAt,
        snippet: conflict.description,
        metadata: {
          claimType: conflict.claimType,
          severity: conflict.severity,
          values: conflict.values,
        },
      })),
      ...institutionMismatch
        ? institutionMismatch.claims.slice(0, 3).map((claim) => claimEvidence(
          claim,
          `${claim.sourceId} affiliation ${extractInstitution(claim.value) ?? 'unknown'}`,
        ))
        : [],
    ];

    findings.push({
      findingType: 'divergence',
      severity,
      title: `${provider.label} has unresolved cross-source divergence`,
      summary: [
        conflictSnippets[0] ?? '',
        ...institutionSnippet,
        ...staleSnippet,
      ].filter((value) => value.length > 0).join(' '),
      entityIds: [npi],
      entities: [
        providerEntity(npi, provider.label),
        ...provider.institutions.slice(0, 2).map((institution) => institutionEntity(institution)),
      ],
      supportingEvidence,
      confidence: report.hasBlocking ? 0.93 : 0.81,
      explanation: `${provider.label} was flagged because authoritative sources are not telling the same story. The divergence finding combines direct conflict rules, affiliation mismatches, and stale-source contradictions when they materially increase review risk.`,
      dedupeKey: `divergence:${npi}`,
      storylineKey: `divergence:${npi}`,
      scoreSignals: {
        trustImpact: clamp01((report.totalPenalty / 20) + (staleSignals.length * 0.08)),
        freshness: recencyScore(nowIso, [
          ...report.conflicts.map((conflict) => conflict.detectedAt),
          ...staleSignals.map((dimension) => dimension.lastVerifiedAt),
        ]),
        novelty: 0.92,
        entityImportance: clamp01(0.5 + provider.graphCentrality),
        graphCentrality: provider.graphCentrality,
      },
      metadata: {
        npi,
        totalPenalty: report.totalPenalty,
        conflicts: report.conflicts,
        staleDimensions: staleSignals,
        institutionMismatch: institutionMismatch?.names ?? [],
      },
    });
  }

  return findings;
}

async function selectNetworkRootNodeIds(prisma: PrismaClient, nowIso: string, batchSize: number, targetNpis: string[]): Promise<string[]> {
  if (targetNpis.length > 0) {
    return targetNpis.map((npi) => clinicianNodeIdForNpi(npi));
  }

  const edges = await prisma.graphEdge.findMany({
    where: {
      edgeType: { in: COLLABORATION_EDGE_TYPES },
      status: 'ACTIVE',
      createdAt: { gte: daysAgo(nowIso, 90) },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      sourceNodeId: true,
      targetNodeId: true,
    },
    take: batchSize * 20,
  });

  return [...new Set(edges.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]))].slice(0, batchSize * 2);
}

function extractProviderIdFromNode(node: Pick<GraphNode, 'metadata'>): string | null {
  return asString(asRecord(node.metadata).npi);
}

async function buildNetworkEmergenceFindings(
  prisma: PrismaClient,
  nowIso: string,
  batchSize: number,
  targetNpis: string[],
  markCovered: (entityId: string) => void,
): Promise<InvestigatorFindingDraft[]> {
  const recentEdges = await prisma.graphEdge.findMany({
    where: {
      edgeType: { in: COLLABORATION_EDGE_TYPES },
      status: 'ACTIVE',
      createdAt: { gte: daysAgo(nowIso, 90) },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      sourceNode: true,
      targetNode: true,
    },
    take: Math.max(100, batchSize * 40),
  });

  if (recentEdges.length === 0) {
    return [];
  }

  const rootNodeIds = await selectNetworkRootNodeIds(prisma, nowIso, batchSize, targetNpis);
  const edgesByNode = new Map<string, typeof recentEdges>();
  for (const edge of recentEdges) {
    const sourceEdges = edgesByNode.get(edge.sourceNodeId) ?? [];
    sourceEdges.push(edge);
    edgesByNode.set(edge.sourceNodeId, sourceEdges);
    const targetEdges = edgesByNode.get(edge.targetNodeId) ?? [];
    targetEdges.push(edge);
    edgesByNode.set(edge.targetNodeId, targetEdges);
  }

  const findings: InvestigatorFindingDraft[] = [];

  for (const rootNodeId of rootNodeIds) {
    const nodeEdges = edgesByNode.get(rootNodeId) ?? [];
    const rootNode = nodeEdges.find((edge) => edge.sourceNodeId === rootNodeId)?.sourceNode
      ?? nodeEdges.find((edge) => edge.targetNodeId === rootNodeId)?.targetNode
      ?? null;

    if (!rootNode || rootNode.type !== 'clinician') {
      continue;
    }

    const npi = extractProviderIdFromNode(rootNode);
    if (npi) {
      markCovered(npi);
    } else {
      markCovered(rootNodeId);
    }

    const sharedTargets = nodeEdges
      .map((edge) => edge.sourceNodeId === rootNodeId ? edge.targetNode : edge.sourceNode)
      .filter((node) => ['publication', 'trial', 'institution', 'organization'].includes(node.type));

    const peerClinicians = new Map<string, GraphNode>();
    for (const targetNode of sharedTargets) {
      for (const edge of edgesByNode.get(targetNode.id) ?? []) {
        const otherNode = edge.sourceNodeId === targetNode.id ? edge.targetNode : edge.sourceNode;
        if (otherNode.id === rootNodeId || otherNode.type !== 'clinician') {
          continue;
        }
        peerClinicians.set(otherNode.id, otherNode);
      }
    }

    if (peerClinicians.size < 2 || sharedTargets.length < 2) {
      continue;
    }

    const avgConfidence = nodeEdges.length > 0
      ? nodeEdges.reduce((sum, edge) => sum + edge.confidence, 0) / nodeEdges.length
      : 0.5;
    const rootLabel = rootNode.label;
    const peerProviderIds = [...peerClinicians.values()]
      .map((node) => extractProviderIdFromNode(node))
      .filter((value): value is string => Boolean(value));
    const clusterEntities: FindingEntityLink[] = [
      ...(npi ? [providerEntity(npi, rootLabel)] : []),
      ...peerProviderIds.slice(0, 4).map((providerId) => providerEntity(providerId, providerId)),
    ];

    findings.push({
      findingType: 'network_emergence',
      severity: peerClinicians.size >= 4 || sharedTargets.length >= 3 ? 'high' : 'medium',
      title: `${rootLabel} sits inside a newly dense collaboration cluster`,
      summary: `${rootLabel} now links into ${sharedTargets.length} recent collaboration anchors with ${peerClinicians.size} peer clinicians across co-author, co-PI, or co-trial relationships.`,
      entityIds: [rootNodeId, ...peerProviderIds],
      entities: clusterEntities,
      supportingEvidence: nodeEdges.slice(0, 5).map((edge) => graphEvidence(
        edge,
        `${edge.edgeType} edge touching ${rootLabel} at confidence ${edge.confidence.toFixed(2)}`,
      )),
      confidence: clamp01(avgConfidence, 0.65),
      explanation: `${rootLabel} was flagged because recent graph edges formed a denser-than-usual collaboration neighborhood. This finding is intended to surface emerging networks, not to imply endorsement or conflict.`,
      dedupeKey: `network_emergence:${rootNodeId}`,
      storylineKey: `network_emergence:${rootNodeId}`,
      scoreSignals: {
        trustImpact: clamp01((sharedTargets.length * 0.08) + (peerClinicians.size * 0.06)),
        freshness: recencyScore(nowIso, nodeEdges.map((edge) => edge.createdAt)),
        novelty: 0.95,
        entityImportance: clamp01((peerClinicians.size / 6) + clamp01(rootNode.degree / 12, 0.3)),
        graphCentrality: clamp01(rootNode.degree / 12, 0.3),
      },
      metadata: {
        rootNodeId,
        peerClinicianCount: peerClinicians.size,
        sharedTargets: sharedTargets.map((node) => ({ id: node.id, label: node.label, type: node.type })),
      },
    });
  }

  return findings;
}

async function buildWorkforcePressureFindings(
  prisma: PrismaClient,
  nowIso: string,
  batchSize: number,
  targetNpis: string[],
  markCovered: (entityId: string) => void,
): Promise<InvestigatorFindingDraft[]> {
  const [opportunityBuckets, providerBuckets] = await Promise.all([
    prisma.opportunity.groupBy({
      by: ['specialty', 'state'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
    }),
    prisma.personProfile.groupBy({
      by: ['specialty', 'stateOfPractice'],
      where: {
        specialty: { not: null },
        stateOfPractice: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const supplyByBucket = new Map<string, number>();
  for (const bucket of providerBuckets) {
    if (!bucket.specialty || !bucket.stateOfPractice) {
      continue;
    }
    supplyByBucket.set(`${bucket.specialty.toLowerCase()}::${bucket.stateOfPractice.toUpperCase()}`, bucket._count._all);
  }

  const pressureBuckets = opportunityBuckets
    .map((bucket) => {
      const key = `${bucket.specialty.toLowerCase()}::${bucket.state.toUpperCase()}`;
      const supply = supplyByBucket.get(key) ?? 0;
      const pressureScore = Math.round((bucket._count._all * 18) + (Math.max(0, 4 - supply) * 12));
      return {
        specialty: bucket.specialty,
        state: bucket.state,
        demand: bucket._count._all,
        supply,
        pressureScore,
      };
    })
    .filter((bucket) => bucket.pressureScore >= 40)
    .sort((left, right) => right.pressureScore - left.pressureScore)
    .slice(0, Math.max(5, batchSize));

  if (pressureBuckets.length === 0) {
    return [];
  }

  const bucketFilters = pressureBuckets.map((bucket) => ({
    specialty: bucket.specialty,
    stateOfPractice: bucket.state,
  }));
  const profiles = targetNpis.length > 0
    ? await prisma.personProfile.findMany({
      where: { npi: { in: targetNpis } },
      take: batchSize * 2,
    })
    : await prisma.personProfile.findMany({
      where: { OR: bucketFilters },
      take: batchSize * 4,
    });

  const findings: InvestigatorFindingDraft[] = [];
  for (const profile of profiles) {
    if (!profile.npi || !profile.specialty || !profile.stateOfPractice) {
      continue;
    }

    const bucketKey = `${profile.specialty.toLowerCase()}::${profile.stateOfPractice.toUpperCase()}`;
    const bucket = pressureBuckets.find((entry) => `${entry.specialty.toLowerCase()}::${entry.state.toUpperCase()}` === bucketKey);
    if (!bucket) {
      continue;
    }

    markCovered(profile.npi);
    const opportunities = await prisma.opportunity.findMany({
      where: {
        status: 'ACTIVE',
        specialty: bucket.specialty,
        state: bucket.state,
      },
      select: {
        id: true,
        title: true,
        organizationId: true,
      },
      take: 5,
    });
    const provider = await loadProviderContext(prisma, profile.npi);
    const severity = bucket.pressureScore >= 80 ? 'high' : 'medium';

    findings.push({
      findingType: 'workforce_pressure',
      severity,
      title: `${provider.label} matches a high-pressure workforce gap`,
      summary: `${bucket.state} ${bucket.specialty} demand currently outpaces known provider supply (${bucket.demand} active roles vs ${bucket.supply} mapped providers). ${provider.label} sits inside that pressure zone.`,
      entityIds: [profile.npi, ...opportunities.map((opportunity) => opportunity.organizationId)],
      entities: [
        providerEntity(profile.npi, provider.label),
        ...opportunities.map((opportunity) => ({
          entityType: 'institution',
          entityId: opportunity.organizationId,
          entityLabel: opportunity.title,
          relationship: 'hiring_need',
        })),
      ],
      supportingEvidence: opportunities.map((opportunity) => ({
        evidenceId: `opportunity_${simpleHash(opportunity.id)}`,
        evidenceType: 'opportunity',
        sourceId: 'OPPORTUNITY',
        sourceLabel: 'OPPORTUNITY',
        recordType: 'opportunity',
        recordId: opportunity.id,
        observedAt: nowIso,
        snippet: `${opportunity.title} is active in ${bucket.state} for ${bucket.specialty}`,
      })),
      confidence: 0.88,
      explanation: `${provider.label} was flagged because internal hiring demand materially exceeds mapped workforce supply for ${bucket.specialty} in ${bucket.state}. This is an operational staffing signal, not a trust downgrade.`,
      dedupeKey: `workforce_pressure:${profile.npi}:${bucket.specialty.toLowerCase()}:${bucket.state.toUpperCase()}`,
      storylineKey: `workforce_pressure:${profile.npi}`,
      scoreSignals: {
        trustImpact: clamp01(bucket.pressureScore / 100),
        freshness: recencyScore(nowIso, [nowIso]),
        novelty: 0.9,
        entityImportance: clamp01(0.45 + provider.graphCentrality),
        graphCentrality: provider.graphCentrality,
      },
      metadata: {
        npi: profile.npi,
        specialty: bucket.specialty,
        state: bucket.state,
        demand: bucket.demand,
        supply: bucket.supply,
        pressureScore: bucket.pressureScore,
      },
    });
  }

  return findings;
}

function parseIndustryStats(artifact: Pick<VerificationArtifact, 'id' | 'npi' | 'verifiedAt' | 'rawPayload'>): IndustryStats | null {
  const payload = asRecord(artifact.rawPayload);
  const rows = Array.isArray(payload.results) ? payload.results : [];
  if (rows.length === 0) {
    return null;
  }

  const payerTotals = new Map<string, number>();
  let totalAmount = 0;
  let recordCount = 0;
  let year: number | null = null;

  for (const row of rows) {
    const record = asRecord(row);
    const amount = asNumber(record.total_amount_of_payment_usdollars) ?? 0;
    const payer = asString(record.applicable_manufacturer_or_applicable_gpo_making_payment_name) ?? 'UNKNOWN_PAYER';
    const yearValue = asString(record.program_year) ?? asString(record.date_of_payment);
    totalAmount += amount;
    recordCount += 1;
    payerTotals.set(payer, (payerTotals.get(payer) ?? 0) + amount);
    if (!year && yearValue) {
      const parsedYear = Number.parseInt(yearValue.slice(0, 4), 10);
      if (Number.isFinite(parsedYear)) {
        year = parsedYear;
      }
    }
  }

  const dominant = [...payerTotals.entries()].sort((left, right) => right[1] - left[1])[0];
  return {
    npi: artifact.npi,
    totalAmount: Math.round(totalAmount * 100) / 100,
    recordCount,
    year,
    dominantPayer: dominant?.[0] ?? null,
    dominantPayerAmount: Math.round((dominant?.[1] ?? 0) * 100) / 100,
    uniquePayerCount: payerTotals.size,
  };
}

async function buildIndustryInfluenceFindings(
  prisma: PrismaClient,
  nowIso: string,
  batchSize: number,
  targetNpis: string[],
  markCovered: (entityId: string) => void,
): Promise<InvestigatorFindingDraft[]> {
  const artifacts = targetNpis.length > 0
    ? await prisma.verificationArtifact.findMany({
      where: {
        npi: { in: targetNpis },
        source: 'OPEN_PAYMENTS',
      },
      orderBy: { verifiedAt: 'desc' },
      take: targetNpis.length * 3,
    })
    : await prisma.verificationArtifact.findMany({
      where: {
        source: 'OPEN_PAYMENTS',
        verifiedAt: { gte: daysAgo(nowIso, 730) },
      },
      orderBy: { verifiedAt: 'desc' },
      take: batchSize * 12,
    });

  const latestByNpi = new Map<string, VerificationArtifact>();
  for (const artifact of artifacts) {
    if (!latestByNpi.has(artifact.npi)) {
      latestByNpi.set(artifact.npi, artifact);
    }
  }

  const stats = [...latestByNpi.values()]
    .map((artifact) => ({ artifact, stats: parseIndustryStats(artifact) }))
    .filter((entry): entry is { artifact: VerificationArtifact; stats: IndustryStats } => entry.stats !== null)
    .slice(0, batchSize);

  const providers = await Promise.all(stats.map(async ({ stats: industry }) => ({
    industry,
    provider: await loadProviderContext(prisma, industry.npi),
  })));

  const clusterByPayer = new Map<string, number>();
  for (const { industry, provider } of providers) {
    if (!industry.dominantPayer || !provider.specialty || !provider.state) {
      continue;
    }
    const clusterKey = `${industry.dominantPayer.toLowerCase()}::${provider.specialty.toLowerCase()}::${provider.state}`;
    clusterByPayer.set(clusterKey, (clusterByPayer.get(clusterKey) ?? 0) + 1);
  }

  const findings: InvestigatorFindingDraft[] = [];
  for (const { industry, provider } of providers) {
    markCovered(industry.npi);
    if (!industry.dominantPayer) {
      continue;
    }

    const concentration = industry.totalAmount > 0 ? industry.dominantPayerAmount / industry.totalAmount : 0;
    const clusterKey = provider.specialty && provider.state
      ? `${industry.dominantPayer.toLowerCase()}::${provider.specialty.toLowerCase()}::${provider.state}`
      : null;
    const clusterSize = clusterKey ? (clusterByPayer.get(clusterKey) ?? 1) : 1;

    if (industry.totalAmount < 5_000 && concentration < 0.6 && clusterSize < 3) {
      continue;
    }

    const severity = industry.totalAmount >= 100_000 || (concentration >= 0.75 && clusterSize >= 3)
      ? 'high'
      : 'medium';
    const dominantPayerPct = Math.round(concentration * 100);

    findings.push({
      findingType: 'industry_influence',
      severity,
      title: `${provider.label} shows concentrated industry-payment influence`,
      summary: `${provider.label} received $${industry.totalAmount.toLocaleString()} in Open Payments records${industry.year ? ` for ${industry.year}` : ''}. ${industry.dominantPayer} accounts for ${dominantPayerPct}% of the total${clusterSize >= 3 ? `, alongside ${clusterSize - 1} peers in the same specialty/state cluster` : ''}.`,
      entityIds: [industry.npi, `sponsor:${industry.dominantPayer.toLowerCase().replace(/\s+/g, '-')}`],
      entities: [
        providerEntity(industry.npi, provider.label),
        {
          entityType: 'sponsor',
          entityId: `sponsor:${industry.dominantPayer.toLowerCase().replace(/\s+/g, '-')}`,
          entityLabel: industry.dominantPayer,
          relationship: 'dominant_payer',
        },
      ],
      supportingEvidence: [
        artifactEvidence(
          latestByNpi.get(industry.npi)!,
          `${industry.dominantPayer} represents ${dominantPayerPct}% of $${industry.totalAmount.toLocaleString()} total payments.`,
        ),
      ],
      confidence: 0.9,
      explanation: `${provider.label} was flagged because Open Payments data shows a meaningful concentration with ${industry.dominantPayer}. The signal is financial-network intelligence only; it is not an allegation of misconduct.`,
      dedupeKey: `industry_influence:${industry.npi}`,
      storylineKey: `industry_influence:${industry.npi}`,
      scoreSignals: {
        trustImpact: clamp01((industry.totalAmount / 100_000) + (concentration * 0.35)),
        freshness: recencyScore(nowIso, [latestByNpi.get(industry.npi)?.verifiedAt]),
        novelty: 0.8,
        entityImportance: clamp01(0.45 + provider.graphCentrality + ((clusterSize - 1) * 0.08)),
        graphCentrality: provider.graphCentrality,
      },
      metadata: {
        npi: industry.npi,
        totalAmount: industry.totalAmount,
        dominantPayer: industry.dominantPayer,
        dominantPayerAmount: industry.dominantPayerAmount,
        dominantPayerPct,
        clusterSize,
        uniquePayerCount: industry.uniquePayerCount,
        year: industry.year,
      },
    });
  }

  return findings;
}

export function buildDefaultInvestigators(): InvestigatorDefinition<BackendInvestigatorDependencies>[] {
  return [
    {
      id: 'trust_decline',
      name: 'Trust Decline Investigator',
      description: 'Detects material provider trust-score drops and surfaces the dimensions that caused the decline.',
      scope: 'provider',
      enabled: true,
      audienceRoles: ['compliance', 'credentialing', 'operations'],
      schedule: {
        cadenceMinutes: 60,
        batchSize: 40,
        suppressionWindowMinutes: 240,
        storylineWindowMinutes: 1_440,
        triggers: ['scheduled', 'targeted', 'event_trust_change'],
      },
      async run(context) {
        return buildTrustDeclineFindings(
          context.dependencies.prisma,
          context.now,
          context.batchSize,
          resolveTargetNpis(context.targetEntityIds),
          context.markEntityCovered,
        );
      },
    },
    {
      id: 'research_momentum',
      name: 'Research Momentum Investigator',
      description: 'Tracks publication acceleration, trial-role growth, and grant-linked research momentum.',
      scope: 'provider',
      enabled: true,
      audienceRoles: ['recruiting', 'executive', 'research'],
      schedule: {
        cadenceMinutes: 360,
        batchSize: 30,
        suppressionWindowMinutes: 720,
        storylineWindowMinutes: 2_880,
        triggers: ['scheduled', 'targeted', 'event_ingestion'],
      },
      async run(context) {
        return buildResearchMomentumFindings(
          context.dependencies.prisma,
          context.now,
          context.batchSize,
          resolveTargetNpis(context.targetEntityIds),
          context.markEntityCovered,
        );
      },
    },
    {
      id: 'divergence',
      name: 'Divergence Investigator',
      description: 'Finds cross-source mismatches spanning specialty, affiliation, and stale-source contradictions.',
      scope: 'provider',
      enabled: true,
      audienceRoles: ['compliance', 'credentialing'],
      schedule: {
        cadenceMinutes: 180,
        batchSize: 40,
        suppressionWindowMinutes: 360,
        storylineWindowMinutes: 1_440,
        triggers: ['scheduled', 'targeted', 'event_ingestion', 'event_trust_change'],
      },
      async run(context) {
        return buildDivergenceFindings(
          context.dependencies.prisma,
          context.now,
          context.batchSize,
          resolveTargetNpis(context.targetEntityIds),
          context.markEntityCovered,
        );
      },
    },
    {
      id: 'network_emergence',
      name: 'Network Emergence Investigator',
      description: 'Detects newly dense collaboration clusters across co-author, co-PI, and co-trial signals.',
      scope: 'network',
      enabled: true,
      audienceRoles: ['executive', 'recruiting', 'research'],
      schedule: {
        cadenceMinutes: 360,
        batchSize: 20,
        suppressionWindowMinutes: 720,
        storylineWindowMinutes: 2_880,
        triggers: ['scheduled', 'targeted', 'event_ingestion'],
      },
      async run(context) {
        return buildNetworkEmergenceFindings(
          context.dependencies.prisma,
          context.now,
          context.batchSize,
          resolveTargetNpis(context.targetEntityIds),
          context.markEntityCovered,
        );
      },
    },
    {
      id: 'workforce_pressure',
      name: 'Workforce Pressure Investigator',
      description: 'Combines specialty, location, and shortage demand to flag providers inside high-need workforce pockets.',
      scope: 'market',
      enabled: true,
      audienceRoles: ['operations', 'recruiting', 'executive'],
      schedule: {
        cadenceMinutes: 720,
        batchSize: 40,
        suppressionWindowMinutes: 1_440,
        storylineWindowMinutes: 2_880,
        triggers: ['scheduled', 'targeted', 'event_ingestion'],
      },
      async run(context) {
        return buildWorkforcePressureFindings(
          context.dependencies.prisma,
          context.now,
          context.batchSize,
          resolveTargetNpis(context.targetEntityIds),
          context.markEntityCovered,
        );
      },
    },
    {
      id: 'industry_influence',
      name: 'Industry Influence Investigator',
      description: 'Highlights concentrated Open Payments and sponsor-cluster patterns across providers.',
      scope: 'market',
      enabled: true,
      audienceRoles: ['compliance', 'executive'],
      schedule: {
        cadenceMinutes: 720,
        batchSize: 30,
        suppressionWindowMinutes: 1_440,
        storylineWindowMinutes: 2_880,
        triggers: ['scheduled', 'targeted', 'event_ingestion'],
      },
      async run(context) {
        return buildIndustryInfluenceFindings(
          context.dependencies.prisma,
          context.now,
          context.batchSize,
          resolveTargetNpis(context.targetEntityIds),
          context.markEntityCovered,
        );
      },
    },
    ...buildAutonomousInvestigatorDefinitions(),
  ];
}
