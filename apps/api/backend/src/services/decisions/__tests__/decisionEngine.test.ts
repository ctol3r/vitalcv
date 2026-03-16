import {
  createDecisionEngine,
  type DecisionFinding,
  type DecisionPrediction,
  type DecisionStoryline,
} from '../../../../../../../core/decisions/decisionEngine';

const NOW = '2026-03-15T12:00:00.000Z';

function providerFinding(input: Partial<DecisionFinding> & Pick<DecisionFinding, 'findingId' | 'findingType' | 'severity' | 'title'>): DecisionFinding {
  return {
    findingId: input.findingId,
    findingType: input.findingType,
    severity: input.severity,
    title: input.title,
    summary: input.summary ?? input.title,
    explanation: input.explanation ?? input.title,
    primaryEntity: input.primaryEntity ?? {
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Ada Lovelace',
    },
    entities: input.entities ?? [{
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Ada Lovelace',
      relationship: 'subject',
    }],
    confidence: input.confidence ?? 0.84,
    priorityScore: input.priorityScore ?? 0.8,
    graphCentrality: input.graphCentrality ?? 0.7,
    entityImportance: input.entityImportance ?? 0.78,
    createdAt: input.createdAt ?? NOW,
    updatedAt: input.updatedAt ?? NOW,
    metadata: input.metadata ?? {},
  };
}

function storyline(input: Partial<DecisionStoryline> & Pick<DecisionStoryline, 'storylineKey' | 'storylineType' | 'title'>): DecisionStoryline {
  return {
    storylineKey: input.storylineKey,
    storylineType: input.storylineType,
    title: input.title,
    narrative: input.narrative ?? input.title,
    severity: input.severity ?? 'high',
    confidence: input.confidence ?? 0.8,
    targetEntity: input.targetEntity ?? {
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Ada Lovelace',
    },
    findingIds: input.findingIds ?? [],
    findingTypes: input.findingTypes ?? [],
    updatedAt: input.updatedAt ?? NOW,
    metadata: input.metadata ?? {},
  };
}

function prediction(input: Partial<DecisionPrediction> & Pick<DecisionPrediction, 'predictionId' | 'predictionType'>): DecisionPrediction {
  return {
    predictionId: input.predictionId,
    predictionType: input.predictionType,
    targetEntity: input.targetEntity ?? {
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Ada Lovelace',
    },
    probability: input.probability ?? 0.8,
    confidence: input.confidence ?? 0.82,
    timeHorizon: input.timeHorizon ?? '90d',
    explanation: input.explanation ?? input.predictionType,
    evidenceSignals: input.evidenceSignals ?? [],
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? NOW,
    updatedAt: input.updatedAt ?? NOW,
  };
}

describe('decision engine', () => {
  it('emits MONITOR_PROVIDER when provider trajectory is rising and specialty pressure is severe', () => {
    const engine = createDecisionEngine();
    const decisions = engine.generate({
      findings: [
        providerFinding({
          findingId: 'finding-workforce-pressure',
          findingType: 'workforce_pressure',
          severity: 'high',
          title: 'Cardiology workforce pressure remains severe',
          metadata: {
            pressureScore: 86,
            graphCentrality: 0.7,
          },
        }),
      ],
      storylines: [
        storyline({
          storylineKey: 'provider-pressure',
          storylineType: 'WORKFORCE_OPPORTUNITY',
          title: 'Workforce pressure remains severe',
          findingTypes: ['workforce_pressure'],
          metadata: {
            pressureScore: 86,
            graphCentrality: 0.7,
          },
        }),
      ],
      predictions: [
        prediction({
          predictionId: 'pred-emerging-investigator',
          predictionType: 'EMERGING_INVESTIGATOR',
          probability: 0.78,
          confidence: 0.8,
          evidenceSignals: [
            { label: 'recent_trials', value: 2, direction: 'UP', source: 'CLINICAL_TRIALS' },
          ],
          metadata: {
            graphDegree: 8,
          },
        }),
      ],
      now: NOW,
    });

    expect(decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recommendation: 'MONITOR_PROVIDER',
        priority: 'high',
        explanation: expect.stringContaining('trajectory is rising'),
      }),
    ]));
  });

  it('emits explainable provider, institution, and specialty decisions from deterministic rules', () => {
    const engine = createDecisionEngine();
    const decisions = engine.generate({
      findings: [
        providerFinding({
          findingId: 'finding-trust-decline',
          findingType: 'trust_decline',
          severity: 'critical',
          title: 'Credential freshness and trust signals are deteriorating',
          metadata: {
            staleDimensions: [{ claimClass: 'licensure' }],
            graphCentrality: 0.72,
          },
          entities: [
            {
              entityType: 'provider',
              entityId: '1234567890',
              entityLabel: 'Ada Lovelace',
              relationship: 'subject',
            },
            {
              entityType: 'institution',
              entityId: 'mayo-clinic',
              entityLabel: 'Mayo Clinic',
              relationship: 'affiliated_with',
            },
          ],
        }),
        providerFinding({
          findingId: 'finding-network-emergence',
          findingType: 'network_emergence',
          severity: 'medium',
          title: 'A new collaboration cluster is forming',
        }),
      ],
      storylines: [],
      predictions: [
        prediction({
          predictionId: 'pred-trust-decline',
          predictionType: 'TRUST_SCORE_DECLINE',
          probability: 0.9,
          confidence: 0.86,
          evidenceSignals: [
            { label: 'stale_sources', value: 2, direction: 'UP', source: 'CLAIM_RECORDS' },
            { label: 'divergence_signals', value: 1, direction: 'UP', source: 'INVESTIGATOR_FINDINGS' },
          ],
        }),
        prediction({
          predictionId: 'pred-institution-growth',
          predictionType: 'INSTITUTION_RESEARCH_GROWTH',
          targetEntity: {
            entityType: 'institution',
            entityId: 'mayo-clinic',
            entityLabel: 'Mayo Clinic',
          },
          probability: 0.82,
          confidence: 0.81,
          evidenceSignals: [
            { label: 'research_growth', value: 1.7, direction: 'UP', source: 'OPENALEX' },
            { label: 'contributing_providers', value: 5, direction: 'UP', source: 'OPENALEX' },
          ],
        }),
        prediction({
          predictionId: 'pred-specialty-pressure',
          predictionType: 'WORKFORCE_SHORTAGE_ESCALATION',
          targetEntity: {
            entityType: 'specialty',
            entityId: 'ca-cardiology',
            entityLabel: 'CA Cardiology',
          },
          probability: 0.84,
          confidence: 0.79,
          evidenceSignals: [
            { label: 'active_demand', value: 142, direction: 'UP', source: 'OPPORTUNITIES' },
            { label: 'mapped_supply', value: 78, direction: 'FLAT', source: 'PERSON_PROFILES' },
            { label: 'pressure_score', value: 86, direction: 'UP', source: 'OPPORTUNITIES' },
          ],
        }),
      ],
      now: NOW,
    });

    expect(decisions.map((decision: { recommendation: string }) => decision.recommendation)).toEqual(expect.arrayContaining([
      'VERIFY_CREDENTIAL',
      'ESCALATE_RISK',
      'INVESTIGATE_NETWORK',
      'REVIEW_INSTITUTION',
      'TRACK_SPECIALTY',
    ]));

    const specialtyDecision = decisions.find((decision: { recommendation: string }) => decision.recommendation === 'TRACK_SPECIALTY');
    expect(specialtyDecision).toEqual(expect.objectContaining({
      targetEntity: expect.objectContaining({
        entityType: 'specialty',
        entityId: 'ca-cardiology',
      }),
      explanation: expect.stringContaining('demand exceeds mapped supply'),
    }));

    const verifyCredential = decisions.find((decision: { recommendation: string }) => decision.recommendation === 'VERIFY_CREDENTIAL');
    expect(verifyCredential?.supportingSignals.length).toBeGreaterThan(0);
    expect(verifyCredential?.priority).toBe('urgent');
  });
});
