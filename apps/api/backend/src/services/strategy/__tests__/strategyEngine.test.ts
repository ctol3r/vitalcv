import {
  createStrategyEngine,
  type StrategyEngineInput,
  type StrategySupportingPrediction,
} from '../../../../../../../core/strategy/strategyEngine';

function prediction(input: Partial<StrategySupportingPrediction> & {
  predictionId: string;
  predictionType: string;
}): StrategySupportingPrediction {
  return {
    predictionId: input.predictionId,
    predictionType: input.predictionType,
    probability: input.probability ?? 0.8,
    confidence: input.confidence ?? 0.76,
    explanation: input.explanation ?? `${input.predictionType} explanation`,
    createdAt: input.createdAt ?? '2026-03-15T12:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-03-15T12:00:00.000Z',
    metadata: input.metadata ?? {},
  };
}

function baseInput(): StrategyEngineInput {
  return {
    providerSignals: [],
    institutionSignals: [],
    marketSignals: [],
    networkSignals: [],
    now: '2026-03-15T12:00:00.000Z',
  };
}

describe('strategy engine', () => {
  it('creates a provider opportunity when shortage pressure and provider trajectory align', () => {
    const engine = createStrategyEngine();
    const result = engine.generate({
      ...baseInput(),
      providerSignals: [
        {
          provider: {
            entityType: 'provider',
            entityId: '1558302470',
            entityLabel: 'Dr. Ada Hart',
          },
          specialty: 'Cardiology',
          state: 'TX',
          institutions: [],
          risingPrediction: prediction({
            predictionId: 'pred_provider',
            predictionType: 'EMERGING_INVESTIGATOR',
            probability: 0.84,
            confidence: 0.8,
          }),
          marketSignals: [
            {
              scope: {
                entityType: 'specialty',
                entityId: 'specialty:TX:cardiology',
                entityLabel: 'Cardiology in TX',
                geography: 'TX',
                specialty: 'Cardiology',
              },
              shortagePrediction: prediction({
                predictionId: 'pred_market',
                predictionType: 'WORKFORCE_SHORTAGE_ESCALATION',
                probability: 0.88,
                confidence: 0.82,
              }),
              pressureScore: 91,
              demand: 14,
              supply: 3,
              risingProviders: [],
              recommendedActions: [],
              supportingActionIds: [],
            },
          ],
          institutionShiftStorylineIds: [],
          networkStorylineIds: ['stl_network'],
          supportingActionIds: ['act_provider'],
          recommendedActions: ['Prioritize recruiter outreach to Dr. Ada Hart.'],
          publicationGrowth: 4,
          recentTrialCount: 1,
          recentGrantCount: 1,
          citationCount: 130,
          graphDegree: 9,
        },
      ],
    });

    expect(result.some((insight) => insight.type === 'PROVIDER_OPPORTUNITY')).toBe(true);
    const opportunity = result.find((insight) => insight.type === 'PROVIDER_OPPORTUNITY');
    expect(opportunity?.impactLevel).toBe('strategic');
    expect(opportunity?.supportingPredictions).toHaveLength(2);
  });

  it('creates a specialty shift when multiple rising providers share the same shortage market', () => {
    const engine = createStrategyEngine();
    const result = engine.generate({
      ...baseInput(),
      marketSignals: [
        {
          scope: {
            entityType: 'specialty',
            entityId: 'specialty:TX:psychiatry',
            entityLabel: 'Psychiatry in TX',
            geography: 'TX',
            specialty: 'Psychiatry',
          },
          shortagePrediction: prediction({
            predictionId: 'pred_shortage',
            predictionType: 'WORKFORCE_SHORTAGE_ESCALATION',
            probability: 0.83,
            confidence: 0.77,
          }),
          pressureScore: 84,
          demand: 21,
          supply: 6,
          risingProviders: [
            {
              entityType: 'provider',
              entityId: '1111111111',
              entityLabel: 'Dr. Reyes',
            },
            {
              entityType: 'provider',
              entityId: '2222222222',
              entityLabel: 'Dr. Patel',
            },
          ],
          recommendedActions: ['Expand recruiting capacity for Psychiatry in TX.'],
          supportingActionIds: ['act_specialty'],
        },
      ],
    });

    const specialtyShift = result.find((insight) => insight.type === 'SPECIALTY_SHIFT');
    expect(specialtyShift).toBeDefined();
    expect(specialtyShift?.scope.specialty).toBe('Psychiatry');
    expect(specialtyShift?.affectedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'provider', entityId: '1111111111' }),
        expect.objectContaining({ entityType: 'provider', entityId: '2222222222' }),
      ]),
    );
  });

  it('creates institution growth and network cluster insights from linked signals', () => {
    const engine = createStrategyEngine();
    const result = engine.generate({
      ...baseInput(),
      institutionSignals: [
        {
          institution: {
            entityType: 'institution',
            entityId: 'institution:ut-austin',
            entityLabel: 'UT Austin',
          },
          growthPrediction: prediction({
            predictionId: 'pred_institution',
            predictionType: 'INSTITUTION_RESEARCH_GROWTH',
            probability: 0.8,
            confidence: 0.78,
            metadata: {
              researchGrowth: 5,
              contributingProviders: 4,
              leadInvestigatorCount: 2,
            },
          }),
          linkedRisingProviders: [
            {
              entityType: 'provider',
              entityId: '3333333333',
              entityLabel: 'Dr. Lin',
            },
          ],
          linkedNetworkCount: 2,
          supportingStorylineIds: ['stl_growth'],
          supportingActionIds: ['act_growth'],
          recommendedActions: ['Open growth-watch coverage for UT Austin.'],
        },
      ],
      networkSignals: [
        {
          network: {
            entityType: 'network',
            entityId: 'network:3333333333',
            entityLabel: 'Cluster around Dr. Lin',
            geography: 'TX',
            specialty: 'Oncology',
          },
          anchorEntity: {
            entityType: 'provider',
            entityId: '3333333333',
            entityLabel: 'Dr. Lin',
          },
          peerEntities: [
            {
              entityType: 'provider',
              entityId: '4444444444',
              entityLabel: 'Dr. Moore',
            },
            {
              entityType: 'provider',
              entityId: '5555555555',
              entityLabel: 'Dr. Gomez',
            },
          ],
          expansionPrediction: prediction({
            predictionId: 'pred_network',
            predictionType: 'NETWORK_CLUSTER_EXPANSION',
            probability: 0.79,
            confidence: 0.75,
            metadata: {
              recentConnections: 6,
            },
          }),
          supportingStorylineIds: ['stl_network'],
          supportingActionIds: ['act_network'],
          recommendedActions: ['Map the collaborators around Dr. Lin.'],
          specialty: 'Oncology',
          geography: 'TX',
        },
      ],
    });

    expect(result.some((insight) => insight.type === 'INSTITUTION_GROWTH')).toBe(true);
    expect(result.some((insight) => insight.type === 'NETWORK_CLUSTER_FORMING')).toBe(true);
  });
});
