jest.mock('../../predictions/predictionEngineService', () => ({
  listPredictionInsights: jest.fn(),
}));

jest.mock('../../investigators/investigatorEngineService', () => ({
  listInvestigatorFindings: jest.fn(),
}));

jest.mock('../../storylines/storylineService', () => ({
  listStorylines: jest.fn(),
}));

jest.mock('../../intelligenceLayer/intelligenceLayerService', () => ({
  buildPredictionSurfaceForEntity: jest.fn(),
}));

jest.mock('../../intelligence/intelligenceSignalsService', () => ({
  getProviderIntelligenceSummary: jest.fn(),
}));

import { prepareCopilotQuery } from '../../../../../../../core/copilot/copilotEngine';
import { maybeExecutePredictionCopilotQuery } from '../predictionQueryService';
import { listPredictionInsights } from '../../predictions/predictionEngineService';
import { listInvestigatorFindings } from '../../investigators/investigatorEngineService';
import { listStorylines } from '../../storylines/storylineService';
import { buildPredictionSurfaceForEntity } from '../../intelligenceLayer/intelligenceLayerService';
import { getProviderIntelligenceSummary } from '../../intelligence/intelligenceSignalsService';

const listPredictionInsightsMock = listPredictionInsights as jest.MockedFunction<typeof listPredictionInsights>;
const listInvestigatorFindingsMock = listInvestigatorFindings as jest.MockedFunction<typeof listInvestigatorFindings>;
const listStorylinesMock = listStorylines as jest.MockedFunction<typeof listStorylines>;
const buildPredictionSurfaceForEntityMock = buildPredictionSurfaceForEntity as jest.MockedFunction<typeof buildPredictionSurfaceForEntity>;
const getProviderIntelligenceSummaryMock = getProviderIntelligenceSummary as jest.MockedFunction<typeof getProviderIntelligenceSummary>;

describe('prediction copilot query service', () => {
  beforeEach(() => {
    listPredictionInsightsMock.mockReset();
    listInvestigatorFindingsMock.mockReset();
    listStorylinesMock.mockReset();
    buildPredictionSurfaceForEntityMock.mockReset();
    getProviderIntelligenceSummaryMock.mockReset();
  });

  it('returns forecast-ranked copilot results for rising-provider queries', async () => {
    listPredictionInsightsMock.mockResolvedValue({
      total: 1,
      syncedAt: '2026-03-15T00:00:00.000Z',
      predictions: [
        {
          id: 'pred-provider-1',
          type: 'PROVIDER_TRAJECTORY',
          entityType: 'provider',
          entityId: '1234567890',
          entityLabel: 'Dr. Ada Lovelace',
          state: 'rising',
          score: 0.82,
          confidence: 0.78,
          explanation: 'Forecast: Provider trajectory is Rising.',
          signals: [
            {
              label: 'publication_acceleration',
              value: 2.1,
              direction: 'UP',
              source: 'OPENALEX/PUBMED',
            },
          ],
          createdAt: '2026-03-15T00:00:00.000Z',
          updatedAt: '2026-03-15T00:00:00.000Z',
          forecast: true,
          insufficientSignal: false,
          summary: 'Provider trajectory is Rising because publication acceleration is elevated.',
          predictionId: 'pred-provider-1',
          predictionType: 'PROVIDER_TRAJECTORY',
          probability: 0.82,
          targetEntity: {
            entityType: 'provider',
            entityId: '1234567890',
            entityLabel: 'Dr. Ada Lovelace',
          },
          timeHorizon: '180d',
          evidenceSignals: [
            {
              label: 'publication_acceleration',
              value: 2.1,
              direction: 'UP',
              source: 'OPENALEX/PUBMED',
            },
          ],
          metadata: {
            state: 'rising',
          },
        },
      ],
    });
    listInvestigatorFindingsMock.mockResolvedValue({
      total: 1,
      findings: [
        {
          id: 'finding-1',
          title: 'Research momentum increased',
        },
      ] as unknown as Awaited<ReturnType<typeof listInvestigatorFindings>>['findings'],
    });
    listStorylinesMock.mockResolvedValue({
      syncedAt: '2026-03-15T00:00:00.000Z',
      storylines: [
        {
          storylineId: 'storyline-1',
          title: 'Rising investigator storyline',
        },
      ] as Awaited<ReturnType<typeof listStorylines>>['storylines'],
    });
    buildPredictionSurfaceForEntityMock.mockResolvedValue({
      predictions: [],
      trajectories: [{
        trajectoryType: 'influence_rising',
        confidence: 0.78,
        explanation: 'Influence is rising.',
        supportingSignals: [],
      }],
      networkChanges: [{
        id: 'net-1',
        changeType: 'new_collaborator',
        entityType: 'provider',
        entityId: '1234567890',
        entityLabel: null,
        counterpartType: 'provider',
        counterpartId: '2234567890',
        counterpartLabel: 'Dr. Grace Hopper',
        confidence: 0.72,
        explanation: 'New collaborator detected.',
        supportingSignals: [],
        observedAt: '2026-03-15T00:00:00.000Z',
      }],
      correlations: [{
        id: 'cor-1',
        correlationType: 'research_program_expansion',
        entities: [{ entityType: 'provider', entityId: '1234567890' }],
        signals: [],
        explanation: 'Research program expansion detected.',
        confidence: 0.81,
        observedAt: '2026-03-15T00:00:00.000Z',
      }],
      signalHistory: [],
      coverage: {
        coverageScore: 86,
        sourceCount: 6,
        missingSources: ['sanctions feeds'],
        confidence: 0.84,
        coveredSources: ['NPPES', 'OpenAlex'],
        updatedAt: '2026-03-15T00:00:00.000Z',
      },
    });
    getProviderIntelligenceSummaryMock.mockResolvedValue({
      npi: '1234567890',
      providerId: 'provider:1234567890',
      providerLabel: 'Dr. Ada Lovelace',
      specialty: 'Cardiology',
      geography: 'CA',
      trust: {
        providerId: 'provider:1234567890',
        providerNpi: '1234567890',
        providerLabel: 'Dr. Ada Lovelace',
        score: 84,
        tier: 'Strong trust',
        confidence: 0.82,
        drivers: [],
        sourceSignals: ['NPPES_API'],
        timestamp: '2026-03-15T00:00:00.000Z',
        last_updated: '2026-03-15T00:00:00.000Z',
        explanation: 'Strong trust.',
        insufficientSignal: false,
      },
      influence: {
        providerId: 'provider:1234567890',
        providerNpi: '1234567890',
        providerLabel: 'Dr. Ada Lovelace',
        score: 88,
        percentile: 0.95,
        tier: 'High Influence',
        confidence: 0.79,
        drivers: [],
        sourceSignals: ['GRAPH_RUNTIME'],
        centrality_delta: 1.4,
        timestamp: '2026-03-15T00:00:00.000Z',
        last_updated: '2026-03-15T00:00:00.000Z',
        explanation: 'High influence.',
        insufficientSignal: false,
      },
      workforcePressure: {
        id: 'cardiology',
        state: 'high',
        score: 72,
        confidence: 0.75,
        drivers: [],
        sourceSignals: ['WORKFORCE_SCARCITY'],
        timestamp: '2026-03-15T00:00:00.000Z',
        last_updated: '2026-03-15T00:00:00.000Z',
        explanation: 'High pressure.',
        specialty: 'Cardiology',
        geography: 'CA',
        hotspots: [],
        insufficientSignal: false,
      },
      institutionMomentum: {
        institutionId: 'mayo-clinic',
        institutionLabel: 'Mayo Clinic',
        state: 'expanding',
        score: 77,
        confidence: 0.7,
        drivers: [],
        sourceSignals: ['NIH_REPORTER'],
        trend_summary: 'Funding and trial activity are increasing.',
        timestamp: '2026-03-15T00:00:00.000Z',
        last_updated: '2026-03-15T00:00:00.000Z',
        explanation: 'Institution momentum is expanding.',
        insufficientSignal: false,
      },
      earlyWarnings: [],
      findings: [],
      storylines: [],
      predictions: [],
      actions: [],
      feed: {
        generatedAt: '2026-03-15T00:00:00.000Z',
        total: 0,
        counts: {
          finding: 0,
          storyline: 0,
          prediction: 0,
          insight: 0,
          early_warning: 0,
        },
        items: [],
      },
      summary: 'Trust is strong, influence is high, and pressure is high.',
      generatedAt: '2026-03-15T00:00:00.000Z',
    });

    const prepared = prepareCopilotQuery({
      query: 'Which providers are rising fastest?',
      limit: 5,
    });

    const response = await maybeExecutePredictionCopilotQuery(prepared, 5);

    expect(response).not.toBeNull();
    expect(response?.results[0]).toEqual(expect.objectContaining({
      id: 'provider:1234567890',
      title: 'Dr. Ada Lovelace',
    }));
    expect(response?.results[0]?.summary).toContain('Coverage: 86%');
    expect(response?.results[0]?.summary).toContain('Network change: new collaborator');
    expect(response?.results[0]?.summary).toContain('Trust is Strong trust (84).');
    expect(response?.results[0]?.summary).toContain('Influence is High Influence (88).');
    expect(response?.explanations[0]?.summary).toContain('Provider trajectory is Rising');
    expect(response?.explanations[0]?.summary).toContain('Research momentum increased');
    expect(response?.explanations[0]?.summary).toContain('Correlation: research program expansion');
    expect(response?.explanations[0]?.because).toEqual(expect.arrayContaining([
      'trust = Strong trust (84)',
      'influence = High Influence (88)',
      'pressure = high',
      'institution momentum = expanding',
    ]));
    expect(response?.graphInsights[0]?.summary).toContain('graph');
  });
});
