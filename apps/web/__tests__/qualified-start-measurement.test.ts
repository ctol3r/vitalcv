import { describe, expect, it } from 'vitest';
import {
  MIN_PUBLISHABLE_COHORT_SIZE,
  deriveQualifiedStartSpan,
  deriveQualifiedStartSpans,
  summarizeQualifiedStartCohort,
  type QualifiedStartEvent,
  type QualifiedStartSpan,
} from '@/lib/trust/qualified-start-measurement';

function event(
  engagementId: string,
  milestone: QualifiedStartEvent['milestone'],
  occurredAt: string,
  extra: Partial<QualifiedStartEvent> = {},
): QualifiedStartEvent {
  return { engagementId, milestone, occurredAt, ...extra };
}

/** A full, well-formed span: offer → reuse → requirement → start → billable. */
const FULL_SPAN: QualifiedStartEvent[] = [
  event('eng-1', 'offer_accepted', '2026-01-05T09:00:00.000Z'),
  event('eng-1', 'evidence_reused', '2026-01-05T09:05:00.000Z', {
    reusedSourceIds: ['nppes_identity', 'oig_exclusions'],
    reverifiedSourceIds: ['state_license'],
  }),
  event('eng-1', 'requirement_cleared', '2026-01-08T12:00:00.000Z'),
  event('eng-1', 'requirement_cleared', '2026-01-09T12:00:00.000Z'),
  event('eng-1', 'start_confirmed', '2026-01-15T09:00:00.000Z'),
  event('eng-1', 'first_billable', '2026-01-20T09:00:00.000Z'),
];

describe('qualified-start measurement — the joined clock', () => {
  it('measures offer_accepted → first_billable as the span, preferring first_billable', () => {
    const span = deriveQualifiedStartSpan('eng-1', FULL_SPAN);

    expect(span.complete).toBe(true);
    expect(span.incompleteReason).toBeNull();
    expect(span.terminalMilestone).toBe('first_billable');
    // 2026-01-05T09:00Z → 2026-01-20T09:00Z is exactly 15 days.
    expect(span.qualifiedStartDays).toBe(15);
    expect(span.requirementsCleared).toBe(2);
  });

  it('falls back to start_confirmed when the employer does not report billing', () => {
    const span = deriveQualifiedStartSpan(
      'eng-1',
      FULL_SPAN.filter((entry) => entry.milestone !== 'first_billable'),
    );

    expect(span.terminalMilestone).toBe('start_confirmed');
    expect(span.qualifiedStartDays).toBe(10);
    expect(span.complete).toBe(true);
  });

  it('is order-independent — events may arrive shuffled', () => {
    const shuffled = [...FULL_SPAN].reverse();
    expect(deriveQualifiedStartSpan('eng-1', shuffled)).toEqual(
      deriveQualifiedStartSpan('eng-1', FULL_SPAN),
    );
  });

  it('uses the EARLIEST occurrence when a milestone is logged more than once', () => {
    const span = deriveQualifiedStartSpan('eng-1', [
      ...FULL_SPAN,
      event('eng-1', 'first_billable', '2026-02-01T09:00:00.000Z'),
      event('eng-1', 'offer_accepted', '2026-01-10T09:00:00.000Z'),
    ]);

    expect(span.qualifiedStartDays).toBe(15);
  });

  it('ignores events belonging to other engagements', () => {
    const span = deriveQualifiedStartSpan('eng-1', [
      ...FULL_SPAN,
      event('eng-2', 'offer_accepted', '2020-01-01T00:00:00.000Z'),
      event('eng-2', 'first_billable', '2020-06-01T00:00:00.000Z'),
    ]);

    expect(span.qualifiedStartDays).toBe(15);
  });
});

describe('qualified-start measurement — refuses to guess', () => {
  it('returns null days when there is no offer_accepted', () => {
    const span = deriveQualifiedStartSpan('eng-1', [
      event('eng-1', 'first_billable', '2026-01-20T09:00:00.000Z'),
    ]);

    expect(span.qualifiedStartDays).toBeNull();
    expect(span.complete).toBe(false);
    expect(span.incompleteReason).toBe('no_offer_accepted');
  });

  it('returns null days when the span has not terminated', () => {
    const span = deriveQualifiedStartSpan('eng-1', [
      event('eng-1', 'offer_accepted', '2026-01-05T09:00:00.000Z'),
      event('eng-1', 'requirement_cleared', '2026-01-08T12:00:00.000Z'),
    ]);

    expect(span.qualifiedStartDays).toBeNull();
    expect(span.incompleteReason).toBe('no_terminal_milestone');
  });

  it('refuses a negative span rather than emitting one', () => {
    const span = deriveQualifiedStartSpan('eng-1', [
      event('eng-1', 'offer_accepted', '2026-01-20T09:00:00.000Z'),
      event('eng-1', 'first_billable', '2026-01-05T09:00:00.000Z'),
    ]);

    expect(span.qualifiedStartDays).toBeNull();
    expect(span.complete).toBe(false);
    expect(span.incompleteReason).toBe('terminal_before_offer');
  });

  it('treats unparseable timestamps as absent instead of coercing them', () => {
    const span = deriveQualifiedStartSpan('eng-1', [
      event('eng-1', 'offer_accepted', 'not-a-date'),
      event('eng-1', 'first_billable', '2026-01-20T09:00:00.000Z'),
    ]);

    expect(span.incompleteReason).toBe('no_offer_accepted');
  });

  it('never exposes a timeSaved figure — that would require a counterfactual', () => {
    const span = deriveQualifiedStartSpan('eng-1', FULL_SPAN);
    const keys = Object.keys(span).join(' ').toLowerCase();

    expect(keys).not.toContain('saved');
    expect(keys).not.toContain('baseline');
  });
});

describe('qualified-start measurement — reuse ratio', () => {
  it('computes reused ÷ observed, excluding lanes that were re-verified', () => {
    const span = deriveQualifiedStartSpan('eng-1', FULL_SPAN);

    expect(span.reuse.reusedCount).toBe(2);
    expect(span.reuse.reverifiedCount).toBe(1);
    expect(span.reuse.reuseRatio).toBeCloseTo(2 / 3);
  });

  it('does not double-count a lane logged as both reused and re-verified', () => {
    const span = deriveQualifiedStartSpan('eng-1', [
      event('eng-1', 'offer_accepted', '2026-01-05T09:00:00.000Z'),
      event('eng-1', 'evidence_reused', '2026-01-05T09:05:00.000Z', {
        reusedSourceIds: ['nppes_identity'],
        reverifiedSourceIds: ['nppes_identity'],
      }),
      event('eng-1', 'first_billable', '2026-01-20T09:00:00.000Z'),
    ]);

    expect(span.reuse.reusedCount).toBe(0);
    expect(span.reuse.reverifiedCount).toBe(1);
    expect(span.reuse.reuseRatio).toBe(0);
  });

  it('distinguishes "nothing observed" (null) from "nothing reused" (0)', () => {
    const nothingObserved = deriveQualifiedStartSpan('eng-1', [
      event('eng-1', 'offer_accepted', '2026-01-05T09:00:00.000Z'),
      event('eng-1', 'first_billable', '2026-01-20T09:00:00.000Z'),
    ]);

    expect(nothingObserved.reuse.reuseRatio).toBeNull();
  });
});

describe('qualified-start measurement — cohort honesty', () => {
  function completeSpan(index: number, days: number): QualifiedStartSpan {
    const start = Date.UTC(2026, 0, 5, 9);
    return deriveQualifiedStartSpan(`eng-${index}`, [
      event(`eng-${index}`, 'offer_accepted', new Date(start).toISOString()),
      event(`eng-${index}`, 'first_billable', new Date(start + days * 86_400_000).toISOString()),
    ]);
  }

  it('aggregates only measured spans and reports how many it excluded', () => {
    const spans = [
      completeSpan(1, 10),
      completeSpan(2, 20),
      completeSpan(3, 30),
      deriveQualifiedStartSpan('eng-4', [event('eng-4', 'offer_accepted', '2026-01-05T09:00:00.000Z')]),
    ];

    const cohort = summarizeQualifiedStartCohort(spans);

    expect(cohort.measuredSpans).toBe(3);
    expect(cohort.excludedIncomplete).toBe(1);
    expect(cohort.medianDays).toBe(20);
    expect(cohort.meanDays).toBe(20);
    expect(cohort.minimumDays).toBe(10);
    expect(cohort.maximumDays).toBe(30);
  });

  it('is not publishable below the minimum cohort size', () => {
    const cohort = summarizeQualifiedStartCohort([completeSpan(1, 10), completeSpan(2, 20)]);

    expect(cohort.measuredSpans).toBe(2);
    expect(cohort.publishable).toBe(false);
  });

  it('becomes publishable at exactly the minimum cohort size', () => {
    const spans = Array.from({ length: MIN_PUBLISHABLE_COHORT_SIZE }, (_, index) =>
      completeSpan(index + 1, 10 + index),
    );

    const cohort = summarizeQualifiedStartCohort(spans);

    expect(cohort.measuredSpans).toBe(MIN_PUBLISHABLE_COHORT_SIZE);
    expect(cohort.publishable).toBe(true);
  });

  it('returns nulls rather than zeros for an empty cohort', () => {
    const cohort = summarizeQualifiedStartCohort([]);

    expect(cohort.medianDays).toBeNull();
    expect(cohort.meanDays).toBeNull();
    expect(cohort.meanReuseRatio).toBeNull();
    expect(cohort.publishable).toBe(false);
  });

  it('derives every engagement in a mixed stream', () => {
    const spans = deriveQualifiedStartSpans([
      ...FULL_SPAN,
      event('eng-2', 'offer_accepted', '2026-02-01T09:00:00.000Z'),
      event('eng-2', 'start_confirmed', '2026-02-11T09:00:00.000Z'),
    ]);

    expect(spans).toHaveLength(2);
    expect(spans.map((span) => span.engagementId)).toEqual(['eng-1', 'eng-2']);
    expect(spans[1].qualifiedStartDays).toBe(10);
  });
});
