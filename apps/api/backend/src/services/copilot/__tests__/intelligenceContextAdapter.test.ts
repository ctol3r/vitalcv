jest.mock('../../intelligence/intelligenceAggregateService', () => ({
  buildInstitutionIntelligenceAggregate: jest.fn(),
  buildNetworkIntelligenceAggregate: jest.fn(),
  buildProviderIntelligenceAggregate: jest.fn(),
  buildSpecialtyIntelligenceAggregate: jest.fn(),
  listInstitutionMomentumSignals: jest.fn(),
  listPressureSignals: jest.fn(),
  listProviderTrajectorySignals: jest.fn(),
  listRecentNetworkChangeSignals: jest.fn(),
  listTopInfluenceSignals: jest.fn(),
  listTopTrustSignals: jest.fn(),
}));

jest.mock('../../intelligence/earlyWarningService', () => ({
  listEarlyWarningSignals: jest.fn(),
}));

import { prepareCopilotQuery } from '../../../../../../../core/copilot/copilotEngine';
import { maybeExecuteIntelligenceContextQuery } from '../intelligenceContextAdapter';
import {
  buildInstitutionIntelligenceAggregate,
  buildNetworkIntelligenceAggregate,
  buildProviderIntelligenceAggregate,
  buildSpecialtyIntelligenceAggregate,
  listInstitutionMomentumSignals,
  listPressureSignals,
  listProviderTrajectorySignals,
  listRecentNetworkChangeSignals,
  listTopInfluenceSignals,
  listTopTrustSignals,
} from '../../intelligence/intelligenceAggregateService';
import { listEarlyWarningSignals } from '../../intelligence/earlyWarningService';
import {
  buildExplainableIntelligence,
  buildFeedItem,
  normalizeDriver,
  normalizeSourceSignal,
  stableIntelligenceId,
  type ExplainableIntelligenceOutput,
} from '../../intelligence/intelligenceDomain';

const buildInstitutionAggregateMock = buildInstitutionIntelligenceAggregate as jest.MockedFunction<typeof buildInstitutionIntelligenceAggregate>;
const buildNetworkAggregateMock = buildNetworkIntelligenceAggregate as jest.MockedFunction<typeof buildNetworkIntelligenceAggregate>;
const buildProviderAggregateMock = buildProviderIntelligenceAggregate as jest.MockedFunction<typeof buildProviderIntelligenceAggregate>;
const buildSpecialtyAggregateMock = buildSpecialtyIntelligenceAggregate as jest.MockedFunction<typeof buildSpecialtyIntelligenceAggregate>;
const listInstitutionMomentumSignalsMock = listInstitutionMomentumSignals as jest.MockedFunction<typeof listInstitutionMomentumSignals>;
const listPressureSignalsMock = listPressureSignals as jest.MockedFunction<typeof listPressureSignals>;
const listProviderTrajectorySignalsMock = listProviderTrajectorySignals as jest.MockedFunction<typeof listProviderTrajectorySignals>;
const listRecentNetworkChangeSignalsMock = listRecentNetworkChangeSignals as jest.MockedFunction<typeof listRecentNetworkChangeSignals>;
const listTopInfluenceSignalsMock = listTopInfluenceSignals as jest.MockedFunction<typeof listTopInfluenceSignals>;
const listTopTrustSignalsMock = listTopTrustSignals as jest.MockedFunction<typeof listTopTrustSignals>;
const listEarlyWarningSignalsMock = listEarlyWarningSignals as jest.MockedFunction<typeof listEarlyWarningSignals>;

function makeSignal(input: {
  type: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  state: string;
  score: number;
  confidence: number;
  summary: string;
  lastUpdated?: string;
}): ExplainableIntelligenceOutput {
  return buildExplainableIntelligence({
    id: stableIntelligenceId(input.type, input.entityId, input.state),
    type: input.type,
    entity: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
    },
    state: input.state,
    score: input.score,
    confidence: input.confidence,
    explanation: {
      summary: input.summary,
      details: [`${input.entityLabel} is ${input.state}.`],
    },
    drivers: [
      normalizeDriver({
        key: 'momentum',
        value: input.score,
        direction: 'UP',
        importance: 0.82,
        source: 'GRAPH_RUNTIME',
        observedAt: input.lastUpdated ?? '2026-03-16T08:00:00.000Z',
        explanation: 'Recent network momentum elevated this signal.',
      }),
    ],
    sourceSignals: [
      normalizeSourceSignal({
        id: stableIntelligenceId('source', input.entityId, input.type),
        type: 'derived_metric',
        label: 'network centrality',
        value: 0.91,
        source: 'GRAPH_RUNTIME',
        confidence: input.confidence,
        observedAt: input.lastUpdated ?? '2026-03-16T08:00:00.000Z',
      }),
    ],
    lastUpdated: input.lastUpdated ?? '2026-03-16T08:00:00.000Z',
  });
}

function makeFeed(headline: string) {
  return buildFeedItem({
    id: stableIntelligenceId('feed', headline),
    type: 'finding',
    headline,
    summary: `${headline} summary`,
    entityRefs: [{
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Dr. Ada Lovelace',
    }],
    confidence: 0.8,
    createdAt: '2026-03-16T08:00:00.000Z',
    updatedAt: '2026-03-16T08:00:00.000Z',
  });
}

describe('intelligence context adapter', () => {
  beforeEach(() => {
    buildInstitutionAggregateMock.mockReset();
    buildNetworkAggregateMock.mockReset();
    buildProviderAggregateMock.mockReset();
    buildSpecialtyAggregateMock.mockReset();
    listInstitutionMomentumSignalsMock.mockReset();
    listPressureSignalsMock.mockReset();
    listProviderTrajectorySignalsMock.mockReset();
    listRecentNetworkChangeSignalsMock.mockReset();
    listTopInfluenceSignalsMock.mockReset();
    listTopTrustSignalsMock.mockReset();
    listEarlyWarningSignalsMock.mockReset();
  });

  it('returns ranked copilot results for highest influence provider queries', async () => {
    listTopInfluenceSignalsMock.mockResolvedValue([
      makeSignal({
        type: 'influence_score',
        entityType: 'provider',
        entityId: '1234567890',
        entityLabel: 'Dr. Ada Lovelace',
        state: 'dominant',
        score: 93,
        confidence: 0.88,
        summary: 'Influence score is elevated because the provider anchors several high-value collaborations.',
      }),
    ]);
    buildProviderAggregateMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      entity: {
        entityType: 'provider',
        entityId: '1234567890',
        entityLabel: 'Dr. Ada Lovelace',
      },
      trustScore: null,
      influenceScore: null,
      trajectorySignals: [],
      recentWarnings: [],
      recentFeed: [makeFeed('Influence storyline advanced this week')],
      recentFindings: [],
      recentStorylines: [],
      recommendedWatchItems: [],
    });

    const prepared = prepareCopilotQuery({
      query: 'Who are the highest influence providers right now?',
      limit: 5,
    });

    const response = await maybeExecuteIntelligenceContextQuery(prepared, 5);

    expect(response).not.toBeNull();
    expect(listTopInfluenceSignalsMock).toHaveBeenCalledWith(5);
    expect(buildProviderAggregateMock).toHaveBeenCalledWith('1234567890');
    expect(response?.results[0]).toEqual(expect.objectContaining({
      id: 'provider:1234567890:influence_score',
      title: 'Dr. Ada Lovelace',
      subtitle: expect.stringContaining('influence score'),
    }));
    expect(response?.explanations[0]?.because).toEqual(expect.arrayContaining([
      expect.stringContaining('Recent network momentum elevated this signal.'),
      expect.stringContaining('network centrality = 0.91'),
    ]));
    expect(response?.graphInsights[0]?.summary).toContain('Influence storyline advanced this week');
  });

  it('routes early warning queries through the warning signal adapter', async () => {
    listEarlyWarningSignalsMock.mockResolvedValue([
      makeSignal({
        type: 'early_warning',
        entityType: 'institution',
        entityId: 'mayo-clinic',
        entityLabel: 'Mayo Clinic',
        state: 'watch',
        score: 81,
        confidence: 0.79,
        summary: 'Early warning indicates trust deterioration risk for Mayo Clinic.',
      }),
    ]);
    buildInstitutionAggregateMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      entity: {
        entityType: 'institution',
        entityId: 'mayo-clinic',
        entityLabel: 'Mayo Clinic',
      },
      momentumSignals: [],
      recentWarnings: [],
      recentFeed: [makeFeed('Institution risk storyline opened')],
      recommendedWatchItems: [],
    });

    const prepared = prepareCopilotQuery({
      query: 'Show me recent early warnings for institutions',
      limit: 3,
    });

    const response = await maybeExecuteIntelligenceContextQuery(prepared, 3);

    expect(response).not.toBeNull();
    expect(listEarlyWarningSignalsMock).toHaveBeenCalledWith({ limit: 3 });
    expect(buildInstitutionAggregateMock).toHaveBeenCalledWith('mayo-clinic');
    expect(response?.results[0]?.title).toBe('Mayo Clinic');
    expect(response?.results[0]?.summary).toContain('Recent context: Institution risk storyline opened.');
  });

  it('returns null when the query does not target an intelligence mode', async () => {
    const prepared = prepareCopilotQuery({
      query: 'Show me passport verification status',
      limit: 5,
    });

    const response = await maybeExecuteIntelligenceContextQuery(prepared, 5);

    expect(response).toBeNull();
    expect(listTopTrustSignalsMock).not.toHaveBeenCalled();
    expect(listTopInfluenceSignalsMock).not.toHaveBeenCalled();
    expect(listEarlyWarningSignalsMock).not.toHaveBeenCalled();
  });
});
