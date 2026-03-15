import type { StorylineFindingInput, StorylineSnapshot } from '../../../../../../../core/storylines/storylineEngine';
import { createStorylineEngine } from '../../../../../../../core/storylines/storylineEngine';

function buildFinding(overrides: Partial<StorylineFindingInput>): StorylineFindingInput {
  return {
    findingId: 'fnd_default',
    category: 'TRUST_DECLINE',
    severity: 'medium',
    title: 'Trust score declined',
    summary: 'Trust score moved down.',
    explanation: 'Confidence weakened after source decay.',
    entityIds: ['provider:1558302470'],
    providerIds: ['provider:1558302470'],
    institutionIds: [],
    graphEntityIds: ['provider:1558302470'],
    relatedFindingIds: [],
    evidence: [
      {
        source: 'TrustScoreV1',
        claim: 'Trust score fell by 12 points',
        confidence: 0.9,
        timestamp: '2026-03-15T12:00:00.000Z',
      },
    ],
    actions: [
      {
        label: 'Open provider investigation',
        type: 'investigate',
      },
    ],
    metadata: {},
    createdAt: '2026-03-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('storyline engine', () => {
  it('clusters related trust findings into a trust decline storyline', () => {
    const engine = createStorylineEngine();
    const result = engine.buildStorylines({
      findings: [
        buildFinding({
          findingId: 'fnd_1',
          title: 'Trust score dropped 12 points',
          summary: 'Recent trust score decline detected.',
        }),
        buildFinding({
          findingId: 'fnd_2',
          category: 'FRESHNESS',
          title: 'Stale licensure source detected',
          summary: 'Primary licensure source is stale.',
          explanation: 'Stale licensure source reduced freshness confidence.',
          createdAt: '2026-03-15T14:00:00.000Z',
        }),
        buildFinding({
          findingId: 'fnd_3',
          category: 'COMPLIANCE',
          title: 'Specialty mismatch noted',
          summary: 'Specialty mismatch observed across sources.',
          explanation: 'Specialty mismatch increased trust risk.',
          createdAt: '2026-03-16T09:00:00.000Z',
        }),
      ],
      now: '2026-03-16T10:00:00.000Z',
    });

    expect(result.storylines).toHaveLength(1);
    expect(result.storylines[0]?.storylineType).toBe('trust decline');
    expect(result.storylines[0]?.perspective).toBe('provider');
    expect(result.storylines[0]?.findingIds).toEqual(['fnd_1', 'fnd_2', 'fnd_3']);
    expect(result.storylines[0]?.supportingEvidence[0]?.bullet).toContain('Trust score');
  });

  it('promotes research signals into a rising investigator storyline', () => {
    const engine = createStorylineEngine();
    const result = engine.buildStorylines({
      findings: [
        buildFinding({
          findingId: 'fnd_a',
          category: 'RESEARCH_MOMENTUM',
          severity: 'low',
          title: 'New NIH grant awarded',
          summary: 'NIH funding increased this quarter.',
          explanation: 'New NIH grant signals research acceleration.',
        }),
        buildFinding({
          findingId: 'fnd_b',
          category: 'NETWORK_EMERGENCE',
          severity: 'medium',
          title: 'New trial investigator role',
          summary: 'Trial investigator role was added.',
          explanation: 'Trial activity expanded this month.',
          createdAt: '2026-03-18T12:00:00.000Z',
        }),
        buildFinding({
          findingId: 'fnd_c',
          category: 'RESEARCH_MOMENTUM',
          severity: 'medium',
          title: 'Publication velocity increased',
          summary: 'Publication output accelerated.',
          explanation: 'Publication acceleration confirms research momentum.',
          createdAt: '2026-03-19T12:00:00.000Z',
        }),
      ],
      now: '2026-03-19T13:00:00.000Z',
    });

    expect(result.storylines).toHaveLength(1);
    expect(result.storylines[0]?.storylineType).toBe('rising investigator');
    expect(result.storylines[0]?.title).toContain('Research momentum');
  });

  it('moves dormant storylines into a quiet state', () => {
    const engine = createStorylineEngine();
    const existing: StorylineSnapshot = {
      storylineId: 'stl_existing',
      fingerprint: 'fingerprint_existing',
      storylineType: 'trust decline',
      perspective: 'provider',
      title: 'Trust risk rising for provider 1558302470',
      summary: 'Trust pressure is building around provider 1558302470.',
      whyItMatters: 'This matters because trust degradation can affect launch decisions.',
      recommendedActions: ['Open provider investigation'],
      severity: 'high',
      confidence: 0.81,
      entityIds: ['provider:1558302470'],
      findingIds: ['fnd_1'],
      supportingEvidence: [
        {
          bullet: 'Trust score declined',
          source: 'TrustScoreV1',
          confidence: 0.91,
          observedAt: '2026-03-01T10:00:00.000Z',
          findingId: 'fnd_1',
        },
      ],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      lastActivityAt: '2026-03-01T10:00:00.000Z',
      status: 'active',
      progressionScore: 0.75,
      noveltyScore: 0.52,
      persistenceScore: 0.61,
      escalationThreshold: 0.63,
      timeline: {
        originEvent: {
          eventKey: 'evt_origin',
          type: 'origin',
          summary: 'Storyline originated from a related finding.',
          occurredAt: '2026-03-01T10:00:00.000Z',
          findingIds: ['fnd_1'],
          toStatus: 'active',
          metadata: {},
        },
        events: [
          {
            eventKey: 'evt_origin',
            type: 'origin',
            summary: 'Storyline originated from a related finding.',
            occurredAt: '2026-03-01T10:00:00.000Z',
            findingIds: ['fnd_1'],
            toStatus: 'active',
            metadata: {},
          },
        ],
        quietPeriods: 0,
        reactivations: 0,
        lastEventAt: '2026-03-01T10:00:00.000Z',
        lastActivityAt: '2026-03-01T10:00:00.000Z',
        currentStatus: 'active',
      },
      metadata: {},
    };

    const result = engine.buildStorylines({
      findings: [],
      existingStorylines: [existing],
      now: '2026-03-10T12:00:00.000Z',
    });

    expect(result.storylines).toHaveLength(1);
    expect(result.storylines[0]?.status).toBe('quiet');
    expect(result.storylines[0]?.timeline.events.some((event) => event.type === 'quiet_period')).toBe(true);
  });
});
