import {
  buildProviderComparison,
  type ProviderComparisonInput,
  type ProviderComparisonResult,
} from '../comparison/providerComparison';

export type InvestigationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface InvestigationSearchEvidence {
  id: string;
  title: string;
  snippet: string;
  sourceUrl?: string;
  provenance: string;
  score: number;
  freshnessStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface TrustDimensionBreakdown {
  key: string;
  score: number;
  max: number;
  status: string;
  explanation: string;
  gaps: string[];
  sources: string[];
}

export interface TrustContradictionBreakdown {
  severity: InvestigationSeverity;
  dimension: string;
  description: string;
  penalty: number;
  sources: string[];
}

export interface TrustTimelinePoint {
  recordedAt: string;
  score: number;
  scoreDelta: number;
  triggerEvent: string;
  band: string | null;
  confidence: number | null;
}

export interface TrustBreakdown {
  npi: string;
  methodology: string;
  score: number;
  band: string;
  bandLabel: string;
  confidence: number;
  totalPenalty: number;
  dimensions: TrustDimensionBreakdown[];
  contradictions: TrustContradictionBreakdown[];
  gaps: string[];
  trustLimits: string[];
  recommendations: string[];
  timeline: TrustTimelinePoint[];
}

export interface NetworkNode {
  id: string;
  label: string;
  entityType: 'PROVIDER' | 'INSTITUTION' | 'ORGANIZATION' | 'SOURCE' | 'ARTIFACT';
  npi?: string;
  metadata: Record<string, unknown>;
}

export interface NetworkEdgeEvidenceCounts {
  coPublicationCount: number;
  sharedGrants: number;
  sharedTrials: number;
  sharedPayments: number;
  sharedInstitutions: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  relationshipTypes: Array<
    'CO_AUTHOR'
    | 'TRIAL_INVESTIGATOR'
    | 'INSTITUTION'
    | 'INDUSTRY_FUNDING'
    | 'GRAPH_RELATIONSHIP'
  >;
  edgeWeight: number;
  evidenceCounts: NetworkEdgeEvidenceCounts;
  evidence: string[];
  metadata: Record<string, unknown>;
}

export interface TraversalResult {
  traversal:
    | 'coAuthorNetwork'
    | 'trialInvestigatorNetwork'
    | 'institutionNetwork'
    | 'industryFundingNetwork';
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface NetworkMap {
  npi: string;
  generatedAt: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  traversals: {
    coAuthorNetwork: TraversalResult;
    trialInvestigatorNetwork: TraversalResult;
    institutionNetwork: TraversalResult;
    industryFundingNetwork: TraversalResult;
  };
  stats: {
    nodeCount: number;
    edgeCount: number;
    maxEdgeWeight: number;
  };
}

export interface InvestigationAnomaly {
  id: string;
  category: 'DIVERGENCE' | 'TRUST_VOLATILITY' | 'GRAPH' | 'NETWORK' | 'SOURCE';
  severity: InvestigationSeverity;
  title: string;
  description: string;
  evidence: string[];
  observedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AnomalyReport {
  npi: string;
  generatedAt: string;
  overallSeverity: InvestigationSeverity | 'NONE';
  anomalyCount: number;
  anomalies: InvestigationAnomaly[];
  recommendedActions: string[];
}

export interface InvestigationGraphSummary {
  nodeCount: number;
  edgeCount: number;
  dominantRelationships: string[];
  highRiskNodes: string[];
}

export interface InvestigationCopilotDigest {
  summary: string;
  reasoning: string[];
  graphHighlights: string[];
}

export interface InvestigationIntelligenceSummary {
  graphInsights: Array<{
    type: string;
    confidence: number;
    explanation: string;
  }>;
  sourceReliability: Array<{
    sourceId: string;
    score: number;
    explanation: string;
  }>;
}

export interface InvestigationProviderProfile {
  npi: string;
  providerName: string;
  primarySpecialty: string | null;
  secondarySpecialties: string[];
  state: string | null;
  affiliations: string[];
  metadata?: Record<string, unknown>;
}

export interface ProviderSummary {
  npi: string;
  providerName: string;
  primarySpecialty: string | null;
  secondarySpecialties: string[];
  state: string | null;
  affiliations: string[];
  trustBreakdown: TrustBreakdown;
  anomalySummary: {
    anomalyCount: number;
    overallSeverity: AnomalyReport['overallSeverity'];
  };
  networkHighlights: string[];
  searchEvidence: InvestigationSearchEvidence[];
  copilotDigest: InvestigationCopilotDigest | null;
  graphSummary: InvestigationGraphSummary | null;
  intelligenceSummary: InvestigationIntelligenceSummary;
}

export interface InvestigationDependencies {
  loadProviderProfile(npi: string): Promise<InvestigationProviderProfile | null>;
  loadSearchEvidence(
    npi: string,
    profile: InvestigationProviderProfile | null,
  ): Promise<InvestigationSearchEvidence[]>;
  loadTrustBreakdown(npi: string): Promise<TrustBreakdown>;
  loadNetworkMap(npi: string): Promise<NetworkMap>;
  loadAnomalyReport(npi: string): Promise<AnomalyReport>;
  loadCopilotDigest(
    npi: string,
    profile: InvestigationProviderProfile | null,
  ): Promise<InvestigationCopilotDigest | null>;
  loadGraphSummary(npi: string): Promise<InvestigationGraphSummary | null>;
  loadIntelligenceSummary(npi: string): Promise<InvestigationIntelligenceSummary>;
  loadComparisonInputs(npiList: string[]): Promise<ProviderComparisonInput[]>;
}

const severityRank: Record<InvestigationSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function highestSeverity(
  anomalies: InvestigationAnomaly[],
): InvestigationSeverity | 'NONE' {
  const sorted = [...anomalies].sort(
    (left, right) => severityRank[right.severity] - severityRank[left.severity],
  );
  return sorted[0]?.severity ?? 'NONE';
}

function summarizeNetwork(network: NetworkMap): string[] {
  const nodeLabels = new Map(network.nodes.map((node) => [node.id, node.label]));

  return [...network.edges]
    .sort((left, right) => right.edgeWeight - left.edgeWeight)
    .slice(0, 3)
    .map((edge) => {
      const relationship = edge.relationshipTypes.join(', ').toLowerCase();
      return `${nodeLabels.get(edge.source) ?? edge.source} -> ${nodeLabels.get(edge.target) ?? edge.target} (${relationship}, weight ${edge.edgeWeight})`;
    });
}

function fallbackProfile(npi: string): InvestigationProviderProfile {
  return {
    npi,
    providerName: `Provider ${npi}`,
    primarySpecialty: null,
    secondarySpecialties: [],
    state: null,
    affiliations: [],
  };
}

export function createInvestigationEngine(dependencies: InvestigationDependencies) {
  return {
    async investigateProvider(npi: string): Promise<ProviderSummary> {
      const profile = await dependencies.loadProviderProfile(npi);
      const resolvedProfile = profile ?? fallbackProfile(npi);

      const [
        trustBreakdown,
        networkMap,
        anomalyReport,
        searchEvidence,
        copilotDigest,
        graphSummary,
        intelligenceSummary,
      ] = await Promise.all([
        dependencies.loadTrustBreakdown(npi),
        dependencies.loadNetworkMap(npi),
        dependencies.loadAnomalyReport(npi),
        dependencies.loadSearchEvidence(npi, resolvedProfile),
        dependencies.loadCopilotDigest(npi, resolvedProfile),
        dependencies.loadGraphSummary(npi),
        dependencies.loadIntelligenceSummary(npi),
      ]);

      return {
        npi,
        providerName: resolvedProfile.providerName,
        primarySpecialty: resolvedProfile.primarySpecialty,
        secondarySpecialties: [...resolvedProfile.secondarySpecialties],
        state: resolvedProfile.state,
        affiliations: [...resolvedProfile.affiliations],
        trustBreakdown,
        anomalySummary: {
          anomalyCount: anomalyReport.anomalyCount,
          overallSeverity: anomalyReport.overallSeverity,
        },
        networkHighlights: summarizeNetwork(networkMap),
        searchEvidence,
        copilotDigest,
        graphSummary,
        intelligenceSummary,
      };
    },

    async traceNetwork(npi: string): Promise<NetworkMap> {
      return dependencies.loadNetworkMap(npi);
    },

    async compareProviders(npiList: string[]): Promise<ProviderComparisonResult> {
      const comparisonInputs = await dependencies.loadComparisonInputs(npiList);
      return buildProviderComparison(comparisonInputs);
    },

    async findAnomalies(npi: string): Promise<AnomalyReport> {
      const report = await dependencies.loadAnomalyReport(npi);
      return {
        ...report,
        overallSeverity: highestSeverity(report.anomalies),
      };
    },
  };
}
