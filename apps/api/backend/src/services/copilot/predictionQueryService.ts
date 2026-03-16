import type {
  CopilotExplanation,
  CopilotGraphInsight,
  CopilotMatch,
  CopilotQueryResponse,
  CopilotResult,
  PreparedCopilotQuery,
} from '../../../../../../core/copilot/copilotEngine';
import type { PredictionQuery, StoredPredictionInsight } from '../predictions/predictionEngineService';
import { listPredictionInsights } from '../predictions/predictionEngineService';
import { buildPredictionSurfaceForEntity } from '../intelligenceLayer/intelligenceLayerService';
import { getProviderIntelligenceSummary } from '../intelligence/intelligenceSignalsService';
import { listInvestigatorFindings } from '../investigators/investigatorEngineService';
import { listStorylines } from '../storylines/storylineService';

type PredictionCopilotMode =
  | 'RISING_PROVIDERS'
  | 'SPECIALTY_PRESSURE'
  | 'INSTITUTION_MOMENTUM'
  | 'NETWORK_SHIFT';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function isPredictionMode(preparedQuery: PreparedCopilotQuery): PredictionCopilotMode | null {
  const raw = normalizeText(preparedQuery.parsedQuery.rawQuery);

  if (
    (/\b(rising|trajectory|forecast)\b/.test(raw) && /\b(provider|providers|clinician|clinicians|who)\b/.test(raw))
    || /\brising fastest\b/.test(raw)
  ) {
    return 'RISING_PROVIDERS';
  }

  if (
    /\b(pressure|shortage|under severe pressure|severe pressure)\b/.test(raw)
    || (preparedQuery.parsedQuery.structuredFilters.specialties.length > 0 && /\b(specialt|specialties)\b/.test(raw))
  ) {
    return 'SPECIALTY_PRESSURE';
  }

  if (
    /\b(expanding research|research momentum|institution.*expanding|which institutions are expanding)\b/.test(raw)
    || /\b(institutions? gained momentum|gained momentum this year|institution momentum)\b/.test(raw)
    || (preparedQuery.parsedQuery.structuredFilters.institutions.length > 0 && /\b(expand|momentum|research)\b/.test(raw))
  ) {
    return 'INSTITUTION_MOMENTUM';
  }

  if (
    /\b(network|collaborat|cluster|bridge|central|hub)\b/.test(raw)
    && /\b(change|changed|shift|what changed|became|more|expand|expanded|growth|grew)\b/.test(raw)
  ) {
    return 'NETWORK_SHIFT';
  }

  return null;
}

function basePredictionQuery(mode: PredictionCopilotMode, limit: number): PredictionQuery {
  switch (mode) {
    case 'RISING_PROVIDERS':
      return {
        type: 'PROVIDER_TRAJECTORY',
        entityType: 'provider',
        state: 'rising',
        limit: Math.max(limit * 4, 20),
        offset: 0,
        sync: true,
      };
    case 'SPECIALTY_PRESSURE':
      return {
        type: 'SPECIALTY_PRESSURE',
        entityType: 'specialty',
        state: 'severe',
        limit: Math.max(limit * 4, 20),
        offset: 0,
        sync: true,
      };
    case 'INSTITUTION_MOMENTUM':
      return {
        type: 'INSTITUTION_MOMENTUM',
        entityType: 'institution',
        state: 'expanding',
        limit: Math.max(limit * 4, 20),
        offset: 0,
        sync: true,
      };
    case 'NETWORK_SHIFT':
      return {
        type: 'NETWORK_SHIFT',
        limit: Math.max(limit * 4, 20),
        offset: 0,
        sync: true,
      };
  }
}

function filterPredictionMatches(
  predictions: StoredPredictionInsight[],
  preparedQuery: PreparedCopilotQuery,
  mode: PredictionCopilotMode,
): StoredPredictionInsight[] {
  const specialties = preparedQuery.parsedQuery.structuredFilters.specialties.map((entry) => normalizeText(entry));
  const institutions = preparedQuery.parsedQuery.structuredFilters.institutions.map((entry) => normalizeText(entry));
  const npiMatch = preparedQuery.parsedQuery.rawQuery.match(/\b\d{10}\b/);

  const filtered = predictions.filter((prediction) => {
    if (mode === 'NETWORK_SHIFT' && npiMatch?.[0] && prediction.entityId !== npiMatch[0]) {
      return false;
    }

    if (specialties.length > 0 && prediction.entityLabel) {
      const label = normalizeText(prediction.entityLabel);
      if (!specialties.some((specialty) => label.includes(specialty))) {
        return false;
      }
    }

    if (institutions.length > 0 && prediction.entityLabel) {
      const label = normalizeText(prediction.entityLabel);
      if (!institutions.some((institution) => label.includes(institution))) {
        return false;
      }
    }

    return true;
  });

  return filtered.length > 0 ? filtered : predictions;
}

function predictionResultType(prediction: StoredPredictionInsight): CopilotResult['type'] {
  if (prediction.entityType === 'provider') {
    return 'CLINICIAN';
  }
  if (prediction.entityType === 'institution') {
    return 'ORGANIZATION';
  }
  if (prediction.entityType === 'specialty') {
    return 'DOCUMENT';
  }
  return 'DOCUMENT';
}

function matchedFilters(
  prediction: StoredPredictionInsight,
  preparedQuery: PreparedCopilotQuery,
): CopilotMatch[] {
  const matches: CopilotMatch[] = [];
  const label = normalizeText(prediction.entityLabel ?? prediction.entityId);

  for (const specialty of preparedQuery.parsedQuery.structuredFilters.specialties) {
    if (label.includes(normalizeText(specialty))) {
      matches.push({
        field: 'specialty',
        value: specialty,
        reason: `specialty matched ${specialty}`,
      });
    }
  }

  for (const institution of preparedQuery.parsedQuery.structuredFilters.institutions) {
    if (label.includes(normalizeText(institution))) {
      matches.push({
        field: 'institution',
        value: institution,
        reason: `institution matched ${institution}`,
      });
    }
  }

  matches.push({
    field: 'keyword',
    value: prediction.state,
    reason: `prediction state matched ${prediction.state}`,
  });

  return matches.slice(0, 3);
}

function buildSummary(
  prediction: StoredPredictionInsight,
  findingTitle?: string,
  storylineTitle?: string,
  extras?: {
    coverageScore?: number | null;
    topTrajectory?: string | null;
    topNetworkChange?: string | null;
    topCorrelation?: string | null;
    providerSignalSummary?: string | null;
  },
): string {
  const fragments = [prediction.summary];
  if (findingTitle) {
    fragments.push(`Supporting finding: ${findingTitle}.`);
  }
  if (storylineTitle) {
    fragments.push(`Storyline context: ${storylineTitle}.`);
  }
  if (typeof extras?.coverageScore === 'number') {
    fragments.push(`Coverage: ${Math.round(extras.coverageScore)}%.`);
  }
  if (extras?.topTrajectory) {
    fragments.push(`Trajectory: ${extras.topTrajectory}.`);
  }
  if (extras?.topNetworkChange) {
    fragments.push(`Network change: ${extras.topNetworkChange}.`);
  }
  if (extras?.topCorrelation) {
    fragments.push(`Correlation: ${extras.topCorrelation}.`);
  }
  if (extras?.providerSignalSummary) {
    fragments.push(extras.providerSignalSummary);
  }
  return fragments.join(' ');
}

function graphInsightType(prediction: StoredPredictionInsight): CopilotGraphInsight['type'] {
  switch (prediction.type) {
    case 'NETWORK_SHIFT':
      return 'COLLABORATOR';
    case 'INSTITUTION_MOMENTUM':
      return 'INSTITUTION_CONNECTION';
    case 'PROVIDER_TRAJECTORY':
      return 'PUBLICATION_NETWORK';
    default:
      return 'SOURCE_COVERAGE';
  }
}

function graphInsightSummary(
  prediction: StoredPredictionInsight,
  extras?: {
    topNetworkChange?: string | null;
    coverageScore?: number | null;
    providerInfluenceExplanation?: string | null;
  },
): string {
  if (extras?.topNetworkChange) {
    return `${prediction.entityLabel ?? prediction.entityId} shows graph context change: ${extras.topNetworkChange}.`;
  }

  if (extras?.providerInfluenceExplanation) {
    return extras.providerInfluenceExplanation;
  }

  if (typeof extras?.coverageScore === 'number') {
    return `${prediction.entityLabel ?? prediction.entityId} has ${Math.round(extras.coverageScore)}% intelligence coverage, which bounds how much graph context is currently explainable.`;
  }

  const graphSignal = prediction.signals.find((signal) =>
    signal.label.includes('network')
    || signal.label.includes('centrality')
    || signal.label.includes('edge')
    || signal.label.includes('cluster'),
  );

  if (!graphSignal) {
    return `${prediction.entityLabel ?? prediction.entityId} has graph context inferred from forecast signals sourced from ${prediction.signals.map((signal) => signal.source ?? 'derived').slice(0, 3).join(', ')}.`;
  }

  return `${prediction.entityLabel ?? prediction.entityId} shows graph context change: ${graphSignal.label.replace(/_/g, ' ')} = ${graphSignal.value}.`;
}

export async function maybeExecutePredictionCopilotQuery(
  preparedQuery: PreparedCopilotQuery,
  limit: number,
): Promise<CopilotQueryResponse | null> {
  const mode = isPredictionMode(preparedQuery);
  if (!mode) {
    return null;
  }

  const predictionQuery = basePredictionQuery(mode, limit);
  let result = await listPredictionInsights(predictionQuery);
  let predictions = filterPredictionMatches(result.predictions, preparedQuery, mode);

  if (predictions.length === 0 && predictionQuery.state) {
    result = await listPredictionInsights({
      ...predictionQuery,
      state: null,
    });
    predictions = filterPredictionMatches(result.predictions, preparedQuery, mode);
  }

  predictions = predictions.slice(0, limit);

  const related = await Promise.all(predictions.map(async (prediction) => {
    const surface = prediction.entityType === 'provider'
      ? await buildPredictionSurfaceForEntity('provider', prediction.entityId).catch(() => null)
      : prediction.entityType === 'institution'
        ? await buildPredictionSurfaceForEntity('institution', prediction.entityId).catch(() => null)
        : prediction.entityType === 'specialty'
          ? await buildPredictionSurfaceForEntity('specialty', prediction.entityId).catch(() => null)
          : null;

    if (prediction.entityType === 'provider') {
      const [findings, storylines] = await Promise.all([
        listInvestigatorFindings({ provider: prediction.entityId, limit: 2, offset: 0 }),
        listStorylines({ provider: prediction.entityId, limit: 2, sync: false }),
      ]);
      const providerSignals = await getProviderIntelligenceSummary(prediction.entityId, {
        sync: false,
        limit: 8,
      }).catch(() => null);

      const providerSignalSummary = providerSignals
        ? [
          `Trust is ${providerSignals.trust.tier}${typeof providerSignals.trust.score === 'number' ? ` (${providerSignals.trust.score})` : ''}.`,
          `Influence is ${providerSignals.influence.tier}${typeof providerSignals.influence.score === 'number' ? ` (${providerSignals.influence.score})` : ''}.`,
          `Workforce pressure is ${providerSignals.workforcePressure.state}.`,
          providerSignals.institutionMomentum
            ? `${providerSignals.institutionMomentum.institutionLabel} is ${providerSignals.institutionMomentum.state}.`
            : null,
        ]
          .filter((entry): entry is string => Boolean(entry))
          .join(' ')
        : null;

      return {
        prediction,
        findingTitle: findings.findings[0]?.title,
        storylineTitle: storylines.storylines[0]?.title,
        coverageScore: surface?.coverage?.coverageScore ?? null,
        topTrajectory: surface?.trajectories[0]?.trajectoryType.replace(/_/g, ' ') ?? null,
        topNetworkChange: surface?.networkChanges[0]?.changeType.replace(/_/g, ' ') ?? null,
        topCorrelation: surface?.correlations[0]?.correlationType.replace(/_/g, ' ') ?? null,
        providerSignals,
        providerSignalSummary,
      };
    }

    if (prediction.entityType === 'institution') {
      const storylines = await listStorylines({ institution: prediction.entityId, limit: 2, sync: false });
      return {
        prediction,
        findingTitle: undefined,
        storylineTitle: storylines.storylines[0]?.title,
        coverageScore: null,
        topTrajectory: surface?.trajectories[0]?.trajectoryType.replace(/_/g, ' ') ?? null,
        topNetworkChange: surface?.networkChanges[0]?.changeType.replace(/_/g, ' ') ?? null,
        topCorrelation: surface?.correlations[0]?.correlationType.replace(/_/g, ' ') ?? null,
        providerSignals: null,
        providerSignalSummary: null,
      };
    }

    return {
      prediction,
      findingTitle: undefined,
      storylineTitle: undefined,
      coverageScore: surface?.coverage?.coverageScore ?? null,
      topTrajectory: surface?.trajectories[0]?.trajectoryType.replace(/_/g, ' ') ?? null,
      topNetworkChange: surface?.networkChanges[0]?.changeType.replace(/_/g, ' ') ?? null,
      topCorrelation: surface?.correlations[0]?.correlationType.replace(/_/g, ' ') ?? null,
      providerSignals: null,
      providerSignalSummary: null,
    };
  }));

  const results: CopilotResult[] = related.map(({ prediction, findingTitle, storylineTitle, coverageScore, topTrajectory, topNetworkChange, topCorrelation, providerSignalSummary }, index) => {
    const relevance = clamp01(prediction.score);
    const trust = prediction.entityType === 'provider' && prediction.type === 'TRUST_RISK_ACCELERATION'
      ? clamp01(1 - prediction.score)
      : clamp01(prediction.confidence * 0.75);
    const freshness = clamp01(1 - Math.min((Date.now() - new Date(prediction.updatedAt).getTime()) / 86_400_000 / 90, 1));
    const coverage = typeof coverageScore === 'number'
      ? clamp01(coverageScore / 100)
      : clamp01(prediction.signals.length / 5);
    const total = clamp01(relevance * 0.45 + trust * 0.2 + freshness * 0.15 + coverage * 0.2);

    return {
      id: `${prediction.entityType}:${prediction.entityId}`,
      rank: index + 1,
      type: predictionResultType(prediction),
      title: prediction.entityLabel ?? prediction.entityId,
      subtitle: `${prediction.type.replace(/_/g, ' ')} · ${prediction.state}`,
      summary: buildSummary(prediction, findingTitle, storylineTitle, {
        coverageScore,
        topTrajectory,
        topNetworkChange,
        topCorrelation,
        providerSignalSummary,
      }),
      specialty: prediction.entityType === 'specialty' ? prediction.entityLabel ?? prediction.entityId : undefined,
      institution: prediction.entityType === 'institution' ? prediction.entityLabel ?? prediction.entityId : undefined,
      scores: {
        relevance,
        trustScore: trust,
        freshness,
        sourceCoverage: coverage,
        total,
      },
      sourceCoverage: [...new Set(prediction.signals.map((signal) => signal.source).filter((source): source is string => Boolean(source)))],
    };
  });

  const explanations: CopilotExplanation[] = related.map(({ prediction, findingTitle, storylineTitle, coverageScore, topTrajectory, topNetworkChange, topCorrelation, providerSignals }, index) => ({
    resultId: results[index]!.id,
    title: results[index]!.title,
    summary: `Forecast reference: ${prediction.summary}${findingTitle ? ` Finding: ${findingTitle}.` : ''}${storylineTitle ? ` Storyline: ${storylineTitle}.` : ''}${typeof coverageScore === 'number' ? ` Coverage: ${Math.round(coverageScore)}%.` : ''}${topNetworkChange ? ` Network: ${topNetworkChange}.` : ''}${topCorrelation ? ` Correlation: ${topCorrelation}.` : ''}`,
    because: [
      `${prediction.type.toLowerCase()} = ${prediction.state}`,
      `confidence = ${Math.round(prediction.confidence * 100)}%`,
      ...(providerSignals ? [
        `trust = ${providerSignals.trust.tier}${typeof providerSignals.trust.score === 'number' ? ` (${providerSignals.trust.score})` : ''}`,
        `influence = ${providerSignals.influence.tier}${typeof providerSignals.influence.score === 'number' ? ` (${providerSignals.influence.score})` : ''}`,
        `pressure = ${providerSignals.workforcePressure.state}`,
        ...(providerSignals.institutionMomentum ? [`institution momentum = ${providerSignals.institutionMomentum.state}`] : []),
      ] : []),
      ...(typeof coverageScore === 'number' ? [`coverage = ${Math.round(coverageScore)}%`] : []),
      ...prediction.signals.slice(0, 2).map((signal) => `${signal.label} = ${signal.value}`),
      ...(topTrajectory ? [`trajectory = ${topTrajectory}`] : []),
      ...(topNetworkChange ? [`network = ${topNetworkChange}`] : []),
      ...(topCorrelation ? [`correlation = ${topCorrelation}`] : []),
      ...(findingTitle ? [`finding = ${findingTitle}`] : []),
      ...(storylineTitle ? [`storyline = ${storylineTitle}`] : []),
    ].slice(0, 6),
    matchedFilters: matchedFilters(prediction, preparedQuery),
    verifiedSources: [...new Set(prediction.signals.map((signal) => signal.source).filter((source): source is string => Boolean(source)))],
    scoring: results[index]!.scores,
  }));

  const graphInsights: CopilotGraphInsight[] = related.map(({ prediction, coverageScore, topNetworkChange, providerSignals }) => ({
    resultId: `${prediction.entityType}:${prediction.entityId}`,
    type: graphInsightType(prediction),
    summary: graphInsightSummary(prediction, {
      topNetworkChange,
      coverageScore,
      providerInfluenceExplanation: providerSignals?.influence.explanation ?? null,
    }),
    path: [prediction.entityLabel ?? prediction.entityId, prediction.type.replace(/_/g, ' '), prediction.state],
    depth: 1,
  }));

  return {
    parsedQuery: preparedQuery.parsedQuery,
    results,
    explanations,
    graphInsights,
  };
}
