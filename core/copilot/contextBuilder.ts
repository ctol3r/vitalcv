export interface CopilotContextAnchor {
  providerId?: string | null;
  findingId?: string | null;
  storylineId?: string | null;
}

export interface CopilotContextProvider {
  providerId: string;
  label: string | null;
  specialty: string | null;
  state: string | null;
  trustScore: number;
  trustBand: string;
  trustConfidence: number;
  activeFindings: number;
  anomalyCount: number;
  anomalySeverity: string | null;
  affiliations: string[];
  networkHighlights: string[];
  sources: string[];
}

export interface CopilotContextFinding {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  findingType: string;
  severity: string;
  status: string;
  confidence: number;
  priorityScore: number;
  createdAt: string;
  storylineId: string | null;
  sources: string[];
}

export interface CopilotContextStoryline {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  storylineType: string;
  severity: string;
  status: string;
  confidence: number;
  lifecycleStage: string | null;
  lastActivityAt: string | null;
  recommendedActions: string[];
  sources: string[];
}

export interface CopilotContextNetworkSummary {
  focusNodeId: string | null;
  nodeCount: number;
  edgeCount: number;
  highlightNodeIds: string[];
  shortestPathScore: number | null;
  topPathSummaries: string[];
  sources: string[];
}

export interface CopilotRiskSignal {
  id: string;
  label: string;
  severity: string;
  explanation: string;
  confidence: number;
  sources: string[];
}

export interface CopilotContext {
  provider: CopilotContextProvider | null;
  recentFindings: CopilotContextFinding[];
  activeStorylines: CopilotContextStoryline[];
  networkSummary: CopilotContextNetworkSummary | null;
  riskSignals: CopilotRiskSignal[];
}

export interface CopilotContextBuilderDependencies {
  loadProvider(anchor: CopilotContextAnchor): Promise<CopilotContextProvider | null>;
  loadRecentFindings(anchor: CopilotContextAnchor): Promise<CopilotContextFinding[]>;
  loadActiveStorylines(anchor: CopilotContextAnchor): Promise<CopilotContextStoryline[]>;
  loadNetworkSummary(anchor: CopilotContextAnchor): Promise<CopilotContextNetworkSummary | null>;
  loadRiskSignals(input: CopilotContext): Promise<CopilotRiskSignal[]>;
}

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStrings(values: readonly string[]): string[] {
  return [...new Set(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )];
}

export async function buildCopilotContext(
  anchor: CopilotContextAnchor,
  dependencies: CopilotContextBuilderDependencies,
): Promise<CopilotContext> {
  const [provider, recentFindings, activeStorylines, networkSummary] = await Promise.all([
    dependencies.loadProvider(anchor),
    dependencies.loadRecentFindings(anchor),
    dependencies.loadActiveStorylines(anchor),
    dependencies.loadNetworkSummary(anchor),
  ]);

  const contextWithoutRiskSignals: CopilotContext = {
    provider: provider
      ? {
          ...provider,
          label: normalizeString(provider.label),
          specialty: normalizeString(provider.specialty),
          state: normalizeString(provider.state),
          affiliations: normalizeStrings(provider.affiliations),
          networkHighlights: normalizeStrings(provider.networkHighlights),
          sources: normalizeStrings(provider.sources),
        }
      : null,
    recentFindings: recentFindings.map((finding) => ({
      ...finding,
      storylineId: normalizeString(finding.storylineId),
      sources: normalizeStrings(finding.sources),
    })),
    activeStorylines: activeStorylines.map((storyline) => ({
      ...storyline,
      lifecycleStage: normalizeString(storyline.lifecycleStage),
      lastActivityAt: normalizeString(storyline.lastActivityAt),
      recommendedActions: normalizeStrings(storyline.recommendedActions),
      sources: normalizeStrings(storyline.sources),
    })),
    networkSummary: networkSummary
      ? {
          ...networkSummary,
          focusNodeId: normalizeString(networkSummary.focusNodeId),
          highlightNodeIds: normalizeStrings(networkSummary.highlightNodeIds),
          topPathSummaries: normalizeStrings(networkSummary.topPathSummaries),
          sources: normalizeStrings(networkSummary.sources),
        }
      : null,
    riskSignals: [],
  };

  const riskSignals = await dependencies.loadRiskSignals(contextWithoutRiskSignals);

  return {
    ...contextWithoutRiskSignals,
    riskSignals: riskSignals.map((signal) => ({
      ...signal,
      sources: normalizeStrings(signal.sources),
    })),
  };
}

export function hasCopilotContext(context: CopilotContext | null | undefined): boolean {
  if (!context) {
    return false;
  }

  return Boolean(
    context.provider
    || context.recentFindings.length > 0
    || context.activeStorylines.length > 0
    || context.networkSummary
    || context.riskSignals.length > 0,
  );
}

export function collectCopilotContextSources(context: CopilotContext | null | undefined): string[] {
  if (!context) {
    return [];
  }

  return normalizeStrings([
    ...(context.provider?.sources ?? []),
    ...context.recentFindings.flatMap((finding) => finding.sources),
    ...context.activeStorylines.flatMap((storyline) => storyline.sources),
    ...(context.networkSummary?.sources ?? []),
    ...context.riskSignals.flatMap((signal) => signal.sources),
  ]);
}
