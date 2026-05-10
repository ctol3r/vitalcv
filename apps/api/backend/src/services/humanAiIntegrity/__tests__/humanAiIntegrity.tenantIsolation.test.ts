import {
  buildAiRecommendation,
  buildReviewerOverride,
  checkLineageCompleteness,
  emitLineageEvent,
  reconstructLineage,
} from '../index';
import type { LineageEvent, ReviewerActor } from '../index';

const TENANT_A = 'tenant-A';
const TENANT_B = 'tenant-B';

function recA(overrides: Partial<Parameters<typeof buildAiRecommendation>[0]> = {}) {
  return buildAiRecommendation({
    recommendationId: overrides.recommendationId ?? 'rec-A',
    tenantId: overrides.tenantId ?? TENANT_A,
    subjectId: overrides.subjectId ?? 'subject-A',
    subjectType: overrides.subjectType ?? 'employer_review',
    emittedAt: overrides.emittedAt ?? '2026-05-09T10:00:00.000Z',
    modelId: overrides.modelId ?? 'classifier-v3',
    modelHash: overrides.modelHash ?? 'mhash-A',
    inputHash: overrides.inputHash ?? 'ihash-A',
    outputHash: overrides.outputHash ?? 'ohash-A',
    tier: overrides.tier ?? 'suggestion_only',
    recommendedAction: overrides.recommendedAction ?? 'route_to_review',
    confidence: overrides.confidence ?? 0.6,
    rationaleSummary: overrides.rationaleSummary ?? 'Stale state-board source detected.',
  });
}

const reviewerB: ReviewerActor = { id: 'reviewer-B', role: 'employer_reviewer', tenantId: TENANT_B };
const reviewerA: ReviewerActor = { id: 'reviewer-A', role: 'employer_reviewer', tenantId: TENANT_A };

describe('humanAiIntegrity — tenant isolation', () => {
  it('emitLineageEvent refuses a reviewer from a different tenant', () => {
    const rec = recA();
    expect(() =>
      emitLineageEvent({
        eventId: 'evt-1',
        eventType: 'AI_RECOMMENDATION_DISPLAYED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:01.000Z',
        reviewerActor: reviewerB,
      }),
    ).toThrow(/tenant/);
  });

  it('buildReviewerOverride refuses a reviewer from a different tenant', () => {
    const rec = recA();
    expect(() =>
      buildReviewerOverride({
        recommendation: rec,
        reviewerActor: reviewerB,
        overrideKind: 'rejected_with_reason',
        confidence: 'high',
        reason: 'Cross-tenant attempt',
        recordedAt: '2026-05-09T10:00:00.000Z',
      }),
    ).toThrow(/tenant/);
  });

  it('reconstructLineage flags tenantBoundaryConsistent=false when an event carries the wrong tenant', () => {
    const rec = recA();
    const goodEmit = emitLineageEvent({
      eventId: 'evt-emit',
      eventType: 'AI_RECOMMENDATION_EMITTED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:01.000Z',
    });
    // Simulate corruption: an event whose tenantId no longer matches.
    const tampered: LineageEvent = { ...goodEmit, eventId: 'evt-tampered', tenantId: TENANT_B };
    const lineage = reconstructLineage([goodEmit, tampered]);
    expect(lineage.tenantBoundaryConsistent).toBe(false);
  });

  it('checkLineageCompleteness raises tenant_isolation violation per offending event', () => {
    const rec = recA();
    const goodEmit = emitLineageEvent({
      eventId: 'evt-emit',
      eventType: 'AI_RECOMMENDATION_EMITTED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:01.000Z',
    });
    const tampered: LineageEvent = { ...goodEmit, eventId: 'evt-tampered', tenantId: TENANT_B };
    const violations = checkLineageCompleteness(rec, [goodEmit, tampered]);
    const tenantViolations = violations.filter((v) => v.invariant === 'tenant_isolation');
    expect(tenantViolations).toHaveLength(1);
    expect(tenantViolations[0]!.detail).toContain('tenant-B');
  });

  it('does not leak tenant-A recommendation into a tenant-B reviewer queue', () => {
    const rec = recA();
    // Emission is system-driven — no reviewer attached, so no cross-tenant
    // assertion at emission time. The downstream reviewer attachment is
    // where the boundary fails. We model that explicitly.
    const emit = emitLineageEvent({
      eventId: 'evt-emit',
      eventType: 'AI_RECOMMENDATION_EMITTED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:01.000Z',
    });
    expect(emit.tenantId).toBe(TENANT_A);
    expect(() =>
      emitLineageEvent({
        eventId: 'evt-disp-leaked',
        eventType: 'AI_RECOMMENDATION_DISPLAYED',
        recommendation: rec,
        occurredAt: '2026-05-09T10:00:05.000Z',
        reviewerActor: reviewerB,
      }),
    ).toThrow();
    // Same-tenant reviewer is admitted.
    const disp = emitLineageEvent({
      eventId: 'evt-disp-ok',
      eventType: 'AI_RECOMMENDATION_DISPLAYED',
      recommendation: rec,
      occurredAt: '2026-05-09T10:00:05.000Z',
      reviewerActor: reviewerA,
    });
    expect(disp.tenantId).toBe(TENANT_A);
  });
});
