import {
  createInvestigationEngine,
  type InvestigationDependencies,
} from '../../../../../../../core/investigation/investigationEngine';

describe('investigationEngine', () => {
  function dependencies(): InvestigationDependencies {
    return {
      loadProviderProfile: async (npi) => ({
        npi,
        providerName: 'Dr. Networked',
        primarySpecialty: 'Cardiology',
        secondarySpecialties: ['Internal Medicine'],
        state: 'CA',
        affiliations: ['Pacific General'],
      }),
      loadSearchEvidence: async () => [{
        id: 'search-1',
        title: 'Pacific General trial profile',
        snippet: 'Provider linked to multiple cardiology studies.',
        provenance: 'search_index',
        score: 9,
      }],
      loadTrustBreakdown: async (npi) => ({
        npi,
        methodology: 'trust-score/v1.0',
        score: 91,
        band: 'L3',
        bandLabel: 'VERIFIED',
        confidence: 0.93,
        totalPenalty: 0,
        dimensions: [],
        contradictions: [],
        gaps: [],
        trustLimits: [],
        recommendations: [],
        timeline: [{
          recordedAt: '2026-03-10T00:00:00.000Z',
          score: 91,
          scoreDelta: 3,
          triggerEvent: 'INGESTION_COMPLETE',
          band: 'L3',
          confidence: 0.93,
        }],
      }),
      loadNetworkMap: async (npi) => ({
        npi,
        generatedAt: '2026-03-15T00:00:00.000Z',
        nodes: [
          { id: 'provider:111', label: 'Dr. Networked', entityType: 'PROVIDER', npi, metadata: {} },
          { id: 'provider:222', label: 'Dr. Colleague', entityType: 'PROVIDER', npi: '2222222222', metadata: {} },
        ],
        edges: [{
          source: 'provider:111',
          target: 'provider:222',
          relationshipTypes: ['CO_AUTHOR', 'TRIAL_INVESTIGATOR'],
          edgeWeight: 3,
          evidenceCounts: {
            coPublicationCount: 2,
            sharedGrants: 0,
            sharedTrials: 1,
            sharedPayments: 0,
            sharedInstitutions: 1,
          },
          evidence: ['shared_publications:2', 'shared_trials:1'],
          metadata: {},
        }],
        traversals: {
          coAuthorNetwork: { traversal: 'coAuthorNetwork', nodes: [], edges: [] },
          trialInvestigatorNetwork: { traversal: 'trialInvestigatorNetwork', nodes: [], edges: [] },
          institutionNetwork: { traversal: 'institutionNetwork', nodes: [], edges: [] },
          industryFundingNetwork: { traversal: 'industryFundingNetwork', nodes: [], edges: [] },
        },
        stats: {
          nodeCount: 2,
          edgeCount: 1,
          maxEdgeWeight: 3,
        },
      }),
      loadAnomalyReport: async (npi) => ({
        npi,
        generatedAt: '2026-03-15T00:00:00.000Z',
        overallSeverity: 'HIGH',
        anomalyCount: 1,
        anomalies: [{
          id: 'anomaly-1',
          category: 'GRAPH',
          severity: 'HIGH',
          title: 'Unexpected graph edge',
          description: 'A high-confidence relationship appeared suddenly.',
          evidence: ['graph:published_with'],
          observedAt: '2026-03-15T00:00:00.000Z',
        }],
        recommendedActions: ['Inspect the new relationship before promotion.'],
      }),
      loadCopilotDigest: async () => ({
        summary: 'Provider is strongly connected through publications and trials.',
        reasoning: ['Trust band L3', 'Shared publication history'],
        graphHighlights: ['Dr. Colleague is connected through three shared studies.'],
      }),
      loadGraphSummary: async () => ({
        nodeCount: 8,
        edgeCount: 10,
        dominantRelationships: ['verified_by', 'depends_on'],
        highRiskNodes: [],
      }),
      loadIntelligenceSummary: async () => ({
        graphInsights: [{
          type: 'HIGH_INFLUENCE_NODE',
          confidence: 0.88,
          explanation: 'Provider is central in the local cardiology cluster.',
        }],
        sourceReliability: [{
          sourceId: 'NPPES_API',
          score: 0.98,
          explanation: 'Government source with strong consistency.',
        }],
      }),
      loadComparisonInputs: async () => [{
        npi: '1111111111',
        providerName: 'Dr. Networked',
        primarySpecialty: 'Cardiology',
        secondarySpecialties: [],
        trustScore: 91,
        trustBand: 'L3',
        publicationMetrics: {
          totalPublications: 10,
          citationCount: 100,
          recentPublications: 2,
        },
        fundingMetrics: {
          totalIndustryPayments: 4_000,
          paymentRecordCount: 2,
          uniquePayers: 1,
          sharedGrantCount: 1,
        },
        trialMetrics: {
          totalTrials: 3,
          activeTrials: 1,
          principalInvestigatorRoles: 1,
        },
      }],
    };
  }

  it('builds a provider summary from the investigation workflow', async () => {
    const engine = createInvestigationEngine(dependencies());
    const summary = await engine.investigateProvider('1111111111');

    expect(summary.providerName).toBe('Dr. Networked');
    expect(summary.trustBreakdown.score).toBe(91);
    expect(summary.networkHighlights[0]).toContain('Dr. Networked');
    expect(summary.anomalySummary.overallSeverity).toBe('HIGH');
    expect(summary.copilotDigest?.summary).toContain('strongly connected');
  });

  it('normalizes anomaly severity from the returned anomaly list', async () => {
    const engine = createInvestigationEngine(dependencies());
    const anomalies = await engine.findAnomalies('1111111111');

    expect(anomalies.overallSeverity).toBe('HIGH');
    expect(anomalies.anomalyCount).toBe(1);
  });
});
