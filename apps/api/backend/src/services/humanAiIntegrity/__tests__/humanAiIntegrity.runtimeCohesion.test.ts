import {
  buildAiRecommendation,
  checkExplainabilityContract,
  checkReplayConsistency,
  emitLineageEvent,
  reconstructLineage,
} from '../index';
import type { AiRecommendation, LineageEvent, ReplaySample } from '../index';

const TENANT = 'tenant-cohesion';

function makeRec(overrides: Partial<Parameters<typeof buildAiRecommendation>[0]> = {}): AiRecommendation {
  return buildAiRecommendation({
    recommendationId: overrides.recommendationId ?? 'rec-cohesion',
    tenantId: overrides.tenantId ?? TENANT,
    subjectId: overrides.subjectId ?? 'subject-cohesion',
    subjectType: overrides.subjectType ?? 'employer_review',
    emittedAt: overrides.emittedAt ?? '2026-05-09T10:00:00.000Z',
    modelId: overrides.modelId ?? 'classifier-v3',
    modelHash: overrides.modelHash ?? 'mhash-cohesion',
    inputHash: overrides.inputHash ?? 'ihash-cohesion',
    outputHash: overrides.outputHash ?? 'ohash-cohesion',
    tier: overrides.tier ?? 'suggestion_only',
    recommendedAction: overrides.recommendedAction ?? 'route_to_review',
    confidence: overrides.confidence ?? 0.6,
    rationaleSummary: overrides.rationaleSummary ?? 'cohesion test',
  });
}

describe('humanAiIntegrity — runtime cohesion / replay safety', () => {
  it('reconstructs lineage events into chronological order regardless of input order', () => {
    const rec = makeRec();
    const e1 = emitLineageEvent({
      eventId: 'e1',
      eventType: 'AI_RECOMMENDATION_EMITTED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:01.000Z',
    });
    const e2 = emitLineageEvent({
      eventId: 'e2',
      eventType: 'AI_RECOMMENDATION_DISPLAYED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:03.000Z',
      reviewerActor: { id: 'r', role: 'employer_reviewer', tenantId: TENANT },
    });
    const e3 = emitLineageEvent({
      eventId: 'e3',
      eventType: 'AI_RECOMMENDATION_ACCEPTED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:08.000Z',
      reviewerActor: { id: 'r', role: 'employer_reviewer', tenantId: TENANT },
      ambiguityAcknowledged: true,
    });

    const shuffled: LineageEvent[] = [e3, e1, e2];
    const lineage = reconstructLineage(shuffled);
    expect(lineage.events.map((e) => e.eventId)).toEqual(['e1', 'e2', 'e3']);
    expect(lineage.emittedAt).toBe('2026-05-09T10:00:01.000Z');
    expect(lineage.resolvedAt).toBe('2026-05-09T10:00:08.000Z');
  });

  it('refuses to reconstruct lineages that mix recommendation IDs', () => {
    const recA = makeRec({ recommendationId: 'rec-A' });
    const recB = makeRec({ recommendationId: 'rec-B' });
    const eA = emitLineageEvent({
      eventId: 'eA',
      eventType: 'AI_RECOMMENDATION_EMITTED',
      recommendation: recA,
      occurredAt: '2026-05-09T10:00:01.000Z',
    });
    const eB = emitLineageEvent({
      eventId: 'eB',
      eventType: 'AI_RECOMMENDATION_EMITTED',
      recommendation: recB,
      occurredAt: '2026-05-09T10:00:01.000Z',
    });
    expect(() => reconstructLineage([eA, eB])).toThrow(/recommendationId/);
  });

  it('replay-safe: same modelHash + inputHash MUST produce same outputHash', () => {
    const samples: ReplaySample[] = [
      { modelHash: 'M-stable', inputHash: 'I-stable', outputHash: 'O-stable', recommendationId: 'r1', tenantId: TENANT },
      { modelHash: 'M-stable', inputHash: 'I-stable', outputHash: 'O-stable', recommendationId: 'r2', tenantId: TENANT },
      { modelHash: 'M-stable', inputHash: 'I-stable', outputHash: 'O-stable', recommendationId: 'r3', tenantId: TENANT },
    ];
    const violations = checkReplayConsistency(samples);
    expect(violations).toHaveLength(0);
  });

  it('replay-unsafe: same input + different output is flagged', () => {
    const samples: ReplaySample[] = [
      { modelHash: 'M', inputHash: 'I', outputHash: 'O-1', recommendationId: 'r1', tenantId: TENANT },
      { modelHash: 'M', inputHash: 'I', outputHash: 'O-2', recommendationId: 'r2', tenantId: TENANT },
    ];
    const violations = checkReplayConsistency(samples);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.invariant).toBe('replay_safe_lineage');
  });

  it('different model versions on the same input are NOT a replay violation (model upgrade)', () => {
    const samples: ReplaySample[] = [
      { modelHash: 'M-v1', inputHash: 'I', outputHash: 'O-1', recommendationId: 'r1', tenantId: TENANT },
      { modelHash: 'M-v2', inputHash: 'I', outputHash: 'O-2', recommendationId: 'r2', tenantId: TENANT },
    ];
    const violations = checkReplayConsistency(samples);
    expect(violations).toHaveLength(0);
  });

  it('full contract check: clean lineage produces zero violations', () => {
    const rec = makeRec({ ambiguityFlags: ['low_confidence'] });
    const events = [
      emitLineageEvent({
        eventId: 'e1',
        eventType: 'AI_RECOMMENDATION_EMITTED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:01.000Z',
      }),
      emitLineageEvent({
        eventId: 'e2',
        eventType: 'AI_RECOMMENDATION_DISPLAYED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:05.000Z',
        reviewerActor: { id: 'r', role: 'employer_reviewer', tenantId: TENANT },
      }),
      emitLineageEvent({
        eventId: 'e3',
        eventType: 'AI_RECOMMENDATION_ACCEPTED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:30.000Z',
        reviewerActor: { id: 'r', role: 'employer_reviewer', tenantId: TENANT },
        ambiguityAcknowledged: true,
        dwellMs: 25_000,
      }),
    ];
    const violations = checkExplainabilityContract({
      recommendation: rec,
      events,
      transitions: [],
      replaySamples: [
        { modelHash: 'mhash-cohesion', inputHash: 'ihash-cohesion', outputHash: 'ohash-cohesion', recommendationId: rec.recommendationId, tenantId: TENANT },
      ],
    });
    expect(violations).toHaveLength(0);
  });
});
