import type {
  CopilotContext,
  CopilotContextAnchor,
  CopilotContextFinding,
  CopilotContextNetworkSummary,
  CopilotContextProvider,
  CopilotContextStoryline,
  CopilotRiskSignal,
} from '../../../../../../core/copilot/contextBuilder';
import {
  buildCopilotContext,
  hasCopilotContext,
} from '../../../../../../core/copilot/contextBuilder';
import type { CopilotQueryContextContract } from './contracts';
import { log } from '../../obs/logger';
import { getWorkbenchContext } from '../investigation/workbenchContextService';
import {
  buildProviderInvestigationPayload,
  buildStorylineInvestigationPayload,
} from '../investigation/investigationWorkbenchService';
import {
  getInvestigatorFinding,
  listInvestigatorFindings,
} from '../investigators/investigatorEngineService';
import { getStorylineDetail, listStorylines } from '../storylines/storylineService';

const NPI_RE = /\b(\d{10})\b/;

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function severityWeight(severity: string): number {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 1;
    case 'high':
      return 0.84;
    case 'medium':
      return 0.62;
    case 'low':
      return 0.38;
    default:
      return 0.22;
  }
}

function providerIdFromQuery(query: string): string | null {
  const direct = query.match(/\b(?:npi|provider)\s*[:#]?\s*(\d{10})\b/i)?.[1];
  if (direct) {
    return direct;
  }

  const fallback = query.match(NPI_RE)?.[1];
  return fallback ?? null;
}

function findingIdFromQuery(query: string): string | null {
  const patterns = [
    /\b(fnd_[a-z0-9_-]{4,})\b/i,
    /\bfinding(?:\s+id)?\s*[:#]?\s*([a-z0-9_-]{4,})\b/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern)?.[1];
    if (match) {
      return match;
    }
  }

  return null;
}

function storylineIdFromQuery(query: string): string | null {
  const patterns = [
    /\b(sl_[a-z0-9_-]{4,})\b/i,
    /\b(stry_[a-z0-9_-]{4,})\b/i,
    /\bstoryline(?:\s+id)?\s*[:#]?\s*([a-z0-9_-]{4,})\b/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern)?.[1];
    if (match) {
      return match;
    }
  }

  return null;
}

export function resolveCopilotContextAnchor(input: {
  query: string;
  providerId?: string | null;
  findingId?: string | null;
  storylineId?: string | null;
  context?: CopilotQueryContextContract;
}): CopilotContextAnchor {
  return {
    providerId: normalizeString(
      input.providerId
      ?? input.context?.provider?.npi
      ?? providerIdFromQuery(input.query),
    ),
    findingId: normalizeString(
      input.findingId
      ?? input.context?.finding?.id
      ?? findingIdFromQuery(input.query),
    ),
    storylineId: normalizeString(
      input.storylineId
      ?? input.context?.storyline?.id
      ?? storylineIdFromQuery(input.query),
    ),
  };
}

export function hasRequestedCopilotAnchor(anchor: CopilotContextAnchor): boolean {
  return Boolean(anchor.providerId || anchor.findingId || anchor.storylineId);
}

function findingSourcesFromDetail(detail: Awaited<ReturnType<typeof getInvestigatorFinding>>): string[] {
  if (!detail) {
    return [];
  }

  return uniqueStrings([
    detail.investigatorId,
    ...detail.supportingEvidence.map((evidence) => (
      normalizeString(evidence.sourceLabel)
      ?? normalizeString(evidence.sourceId)
      ?? normalizeString(evidence.evidenceType)
      ?? ''
    )),
  ]);
}

function mapFindingDetail(
  detail: NonNullable<Awaited<ReturnType<typeof getInvestigatorFinding>>>,
): CopilotContextFinding {
  return {
    id: detail.findingId,
    title: detail.title,
    summary: detail.summary,
    explanation: detail.explanation,
    findingType: detail.findingType,
    severity: detail.severity,
    status: detail.status,
    confidence: detail.confidence,
    priorityScore: detail.priorityScore,
    createdAt: detail.createdAt,
    storylineId: normalizeString(detail.storylineKey),
    sources: findingSourcesFromDetail(detail),
  };
}

function mapNetworkSummary(
  payload:
    | Awaited<ReturnType<typeof buildProviderInvestigationPayload>>['network']
    | NonNullable<Awaited<ReturnType<typeof buildStorylineInvestigationPayload>>>['network'],
): CopilotContextNetworkSummary {
  return {
    focusNodeId: payload.focusNodeId,
    nodeCount: payload.nodes.length,
    edgeCount: payload.edges.length,
    highlightNodeIds: [...payload.highlights.nodeIds],
    shortestPathScore: payload.paths.shortestPath?.score ?? null,
    topPathSummaries: payload.paths.rankedPaths.slice(0, 3).map((path) => path.explanation),
    sources: ['graph_investigation'],
  };
}

function storylineSources(storylineId: string): string[] {
  return uniqueStrings(['storyline_engine', storylineId]);
}

function deriveRiskSignals(context: CopilotContext): CopilotRiskSignal[] {
  const signals: CopilotRiskSignal[] = [];
  const provider = context.provider;

  if (provider) {
    if (provider.trustScore < 85) {
      signals.push({
        id: `trust:${provider.providerId}`,
        label: `Trust score ${Math.round(provider.trustScore)} (${provider.trustBand})`,
        severity: provider.trustScore < 55 ? 'critical' : provider.trustScore < 70 ? 'high' : 'medium',
        explanation: `${provider.label ?? provider.providerId} is below the preferred trust threshold for copiloted review.`,
        confidence: clamp01(provider.trustConfidence),
        sources: provider.sources,
      });
    }

    if (provider.anomalyCount > 0) {
      signals.push({
        id: `anomalies:${provider.providerId}`,
        label: `${provider.anomalyCount} active investigation anomal${provider.anomalyCount === 1 ? 'y' : 'ies'}`,
        severity: normalizeString(provider.anomalySeverity)?.toLowerCase() ?? 'medium',
        explanation: 'Investigation anomalies are active in the current provider summary and should be reconciled before launch decisions.',
        confidence: clamp01(provider.trustConfidence),
        sources: provider.sources,
      });
    }
  }

  for (const finding of context.recentFindings.slice(0, 3)) {
    signals.push({
      id: `finding:${finding.id}`,
      label: finding.title,
      severity: finding.severity,
      explanation: finding.explanation || finding.summary,
      confidence: clamp01(finding.confidence),
      sources: finding.sources,
    });
  }

  for (const storyline of context.activeStorylines.slice(0, 2)) {
    if (!['critical', 'high'].includes(storyline.severity.toLowerCase()) && storyline.lifecycleStage !== 'mature') {
      continue;
    }

    signals.push({
      id: `storyline:${storyline.id}`,
      label: storyline.title,
      severity: storyline.severity,
      explanation: storyline.whyItMatters,
      confidence: clamp01(storyline.confidence),
      sources: storyline.sources,
    });
  }

  const networkSummary = context.networkSummary;
  if (networkSummary && typeof networkSummary.shortestPathScore === 'number') {
    signals.push({
      id: `network:${networkSummary.focusNodeId ?? 'graph'}`,
      label: `Network path score ${networkSummary.shortestPathScore.toFixed(2)}`,
      severity: networkSummary.shortestPathScore >= 0.7 ? 'medium' : 'low',
      explanation: networkSummary.topPathSummaries[0]
        ?? 'Graph investigation returned a reachable neighborhood for the current context.',
      confidence: clamp01(networkSummary.shortestPathScore),
      sources: networkSummary.sources,
    });
  }

  return signals
    .sort((left, right) => (
      severityWeight(right.severity) - severityWeight(left.severity)
      || right.confidence - left.confidence
    ))
    .slice(0, 6);
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    log('warn', 'copilot_context_loader_failed', {
      component: 'copilot_context_service',
      loader: label,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function loadCopilotContext(anchor: CopilotContextAnchor): Promise<CopilotContext> {
  const workbenchPromise = hasRequestedCopilotAnchor(anchor)
    ? safe('workbench', () => getWorkbenchContext({
        npi: anchor.providerId ?? undefined,
        findingId: anchor.findingId ?? undefined,
        storylineId: anchor.storylineId ?? undefined,
      }))
    : Promise.resolve(null);

  const resolvedProviderIdPromise = (async () => {
    const workbench = await workbenchPromise;
    return normalizeString(workbench?.provider?.npi ?? anchor.providerId);
  })();

  const resolvedStorylineIdPromise = (async () => {
    const workbench = await workbenchPromise;
    return normalizeString(workbench?.storyline?.id ?? anchor.storylineId);
  })();

  const providerPayloadPromise = (async () => {
    const providerId = await resolvedProviderIdPromise;
    if (!providerId) {
      return null;
    }
    return safe('provider_investigation', () => buildProviderInvestigationPayload(providerId));
  })();

  const explicitFindingId = normalizeString(anchor.findingId);
  const explicitFindingPromise = explicitFindingId
    ? safe('finding_detail', () => getInvestigatorFinding(explicitFindingId))
    : Promise.resolve(null);

  const providerFindingsPromise = (async () => {
    const providerId = await resolvedProviderIdPromise;
    if (!providerId) {
      return null;
    }
    return safe('provider_findings', () => listInvestigatorFindings({
      provider: providerId,
      limit: 5,
    }));
  })();

  const providerStorylinesPromise = (async () => {
    const providerId = await resolvedProviderIdPromise;
    if (!providerId) {
      return null;
    }
    return safe('provider_storylines', () => listStorylines({
      provider: providerId,
      limit: 5,
      sync: false,
    }));
  })();

  const explicitStorylinePromise = (async () => {
    const storylineId = await resolvedStorylineIdPromise;
    if (!storylineId) {
      return null;
    }
    return safe('storyline_detail', () => getStorylineDetail(storylineId, { sync: false }));
  })();

  const storylinePayloadPromise = (async () => {
    const storylineId = await resolvedStorylineIdPromise;
    if (!storylineId) {
      return null;
    }
    return safe('storyline_investigation', () => buildStorylineInvestigationPayload(storylineId));
  })();

  return buildCopilotContext(anchor, {
    loadProvider: async () => {
      const [workbench, providerPayload] = await Promise.all([
        workbenchPromise,
        providerPayloadPromise,
      ]);

      if (providerPayload) {
        return {
          providerId: providerPayload.providerSummary.npi,
          label: providerPayload.providerSummary.providerName,
          specialty: providerPayload.providerSummary.primarySpecialty,
          state: providerPayload.providerSummary.state,
          trustScore: providerPayload.providerSummary.trustBreakdown.score,
          trustBand: providerPayload.providerSummary.trustBreakdown.bandLabel,
          trustConfidence: providerPayload.providerSummary.trustBreakdown.confidence,
          activeFindings: providerPayload.findingsInbox.total,
          anomalyCount: providerPayload.providerSummary.anomalySummary.anomalyCount,
          anomalySeverity: providerPayload.providerSummary.anomalySummary.overallSeverity,
          affiliations: providerPayload.providerSummary.affiliations,
          networkHighlights: providerPayload.providerSummary.networkHighlights,
          sources: uniqueStrings([
            ...providerPayload.providerSummary.trustBreakdown.dimensions.flatMap((dimension) => dimension.sources),
            ...providerPayload.providerSummary.searchEvidence.map((evidence) => evidence.provenance),
            ...providerPayload.providerSummary.intelligenceSummary.sourceReliability.map((source) => source.sourceId),
          ]),
        } satisfies CopilotContextProvider;
      }

      if (workbench?.provider) {
        return {
          providerId: workbench.provider.npi,
          label: workbench.provider.label,
          specialty: workbench.provider.specialty ?? null,
          state: workbench.provider.state ?? null,
          trustScore: workbench.provider.trustScore,
          trustBand: workbench.provider.trustBand,
          trustConfidence: workbench.provider.trustConfidence,
          activeFindings: workbench.provider.activeFindings,
          anomalyCount: 0,
          anomalySeverity: null,
          affiliations: [],
          networkHighlights: [],
          sources: ['workbench_context'],
        } satisfies CopilotContextProvider;
      }

      return null;
    },
    loadRecentFindings: async () => {
      const [explicitFinding, providerFindings] = await Promise.all([
        explicitFindingPromise,
        providerFindingsPromise,
      ]);

      const mapped = new Map<string, CopilotContextFinding>();
      if (explicitFinding) {
        mapped.set(explicitFinding.findingId, mapFindingDetail(explicitFinding));
      }

      for (const finding of providerFindings?.findings ?? []) {
        mapped.set(finding.findingId, {
          id: finding.findingId,
          title: finding.title,
          summary: finding.summary,
          explanation: finding.explanation,
          findingType: finding.findingType,
          severity: finding.severity,
          status: finding.status,
          confidence: finding.confidence,
          priorityScore: finding.priorityScore,
          createdAt: finding.createdAt,
          storylineId: normalizeString(finding.storylineKey),
          sources: uniqueStrings([
            finding.investigatorId,
            ...finding.supportingEvidence.map((evidence) => (
              normalizeString(evidence.sourceLabel)
              ?? normalizeString(evidence.sourceId)
              ?? normalizeString(evidence.evidenceType)
              ?? ''
            )),
          ]),
        });
      }

      return [...mapped.values()].slice(0, 5);
    },
    loadActiveStorylines: async () => {
      const [providerStorylines, explicitStoryline, storylinePayload] = await Promise.all([
        providerStorylinesPromise,
        explicitStorylinePromise,
        storylinePayloadPromise,
      ]);

      const mapped = new Map<string, CopilotContextStoryline>();

      const upsert = (storyline: CopilotContextStoryline) => {
        mapped.set(storyline.id, storyline);
      };

      for (const storyline of providerStorylines?.storylines ?? []) {
        upsert({
          id: storyline.storylineId,
          title: storyline.title,
          summary: storyline.summary,
          whyItMatters: storyline.whyItMatters,
          storylineType: storyline.storylineType,
          severity: storyline.severity,
          status: storyline.status,
          confidence: storyline.confidence,
          lifecycleStage: null,
          lastActivityAt: normalizeString(storyline.lastActivityAt ?? storyline.updatedAt),
          recommendedActions: [...storyline.recommendedActions],
          sources: storylineSources(storyline.storylineId),
        });
      }

      if (explicitStoryline) {
        upsert({
          id: explicitStoryline.storyline.storylineId,
          title: explicitStoryline.storyline.title,
          summary: explicitStoryline.storyline.summary,
          whyItMatters: explicitStoryline.storyline.whyItMatters,
          storylineType: explicitStoryline.storyline.storylineType,
          severity: explicitStoryline.storyline.severity,
          status: explicitStoryline.storyline.status,
          confidence: explicitStoryline.storyline.confidence,
          lifecycleStage: storylinePayload?.detail.lifecycleStage ?? null,
          lastActivityAt: normalizeString(
            explicitStoryline.storyline.lastActivityAt ?? explicitStoryline.storyline.updatedAt,
          ),
          recommendedActions: [...explicitStoryline.storyline.recommendedActions],
          sources: storylineSources(explicitStoryline.storyline.storylineId),
        });
      }

      return [...mapped.values()].slice(0, 5);
    },
    loadNetworkSummary: async () => {
      const [providerPayload, storylinePayload] = await Promise.all([
        providerPayloadPromise,
        storylinePayloadPromise,
      ]);

      if (providerPayload?.network) {
        return mapNetworkSummary(providerPayload.network);
      }

      if (storylinePayload?.network) {
        return mapNetworkSummary(storylinePayload.network);
      }

      return null;
    },
    loadRiskSignals: async (context) => deriveRiskSignals(context),
  });
}

export function shouldWarmCopilot(anchor: CopilotContextAnchor, context: CopilotContext): boolean {
  return hasRequestedCopilotAnchor(anchor) && !hasCopilotContext(context);
}
