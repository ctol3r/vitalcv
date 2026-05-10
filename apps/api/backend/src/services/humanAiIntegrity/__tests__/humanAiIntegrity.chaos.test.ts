/**
 * W2-PR57A — AI-review chaos simulations.
 *
 * Adversarial event streams designed to surface automation bias signals.
 * Each scenario produces a deterministic event log — no randomness — so the
 * test asserts the detector raises the expected severity, not "flaky maybe".
 */

import { detectAutomationBias } from '../automationBiasDetector';
import {
  buildAiRecommendation,
  emitLineageEvent,
} from '../recommendationLineage';
import type { LineageEvent } from '../index';

const TENANT = 'tenant-chaos';

function rec(id: string, ambiguity: boolean): ReturnType<typeof buildAiRecommendation> {
  return buildAiRecommendation({
    recommendationId: id,
    tenantId: TENANT,
    subjectId: `subject-${id}`,
    subjectType: 'employer_review',
    emittedAt: '2026-05-09T10:00:00.000Z',
    modelId: 'classifier-v3',
    modelHash: 'mhash',
    inputHash: `ihash-${id}`,
    outputHash: `ohash-${id}`,
    tier: 'suggestion_only',
    recommendedAction: 'route_to_review',
    confidence: 0.6,
    rationaleSummary: 'chaos scenario',
    ambiguityFlags: ambiguity ? ['evidence_conflict'] : [],
  });
}

function evt(
  id: string,
  recId: string,
  type: LineageEvent['eventType'],
  occurredAt: string,
  extra: Partial<LineageEvent> = {},
): LineageEvent {
  return {
    eventId: id,
    eventType: type,
    recommendationId: recId,
    tenantId: TENANT,
    subjectId: `subject-${recId}`,
    occurredAt,
    ...extra,
  };
}

const reviewer = { id: 'reviewer-1', role: 'employer_reviewer' as const, tenantId: TENANT };

describe('humanAiIntegrity — chaos: rubber-stamp velocity', () => {
  it('20 accepts within ~30 seconds raises a red rubber_stamp_velocity finding', () => {
    const events: LineageEvent[] = [];
    const start = Date.parse('2026-05-09T10:00:00.000Z');
    for (let i = 0; i < 20; i += 1) {
      const r = rec(`r-${i}`, false);
      events.push(
        evt(`emit-${i}`, r.recommendationId, 'AI_RECOMMENDATION_EMITTED', new Date(start + i * 1500).toISOString()),
      );
      events.push(
        evt(`acc-${i}`, r.recommendationId, 'AI_RECOMMENDATION_ACCEPTED', new Date(start + i * 1500 + 200).toISOString(), {
          reviewerActor: reviewer,
          ambiguityAcknowledged: true,
          dwellMs: 200,
        }),
      );
    }
    const report = detectAutomationBias(events);
    const finding = report.findings.find((f) => f.signal === 'rubber_stamp_velocity');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('red');
    expect(report.worstSeverity).toBe('red');
  });
});

describe('humanAiIntegrity — chaos: acceptance concurrence', () => {
  it('20 accepts and 0 overrides raises red acceptance_concurrence + dissent_drought', () => {
    const events: LineageEvent[] = [];
    const start = Date.parse('2026-05-09T10:00:00.000Z');
    for (let i = 0; i < 20; i += 1) {
      const r = rec(`r-${i}`, false);
      events.push(
        evt(`emit-${i}`, r.recommendationId, 'AI_RECOMMENDATION_EMITTED', new Date(start + i * 60_000).toISOString()),
      );
      events.push(
        evt(`acc-${i}`, r.recommendationId, 'AI_RECOMMENDATION_ACCEPTED', new Date(start + i * 60_000 + 30_000).toISOString(), {
          reviewerActor: reviewer,
          ambiguityAcknowledged: true,
          dwellMs: 30_000,
        }),
      );
    }
    const report = detectAutomationBias(events);
    const concurrence = report.findings.find((f) => f.signal === 'acceptance_concurrence');
    expect(concurrence).toBeDefined();
    expect(concurrence!.severity).toBe('red');
  });
});

describe('humanAiIntegrity — chaos: low dwell', () => {
  it('20 accepts each with dwell ~500ms raises red low_dwell', () => {
    const events: LineageEvent[] = [];
    const start = Date.parse('2026-05-09T10:00:00.000Z');
    for (let i = 0; i < 20; i += 1) {
      const r = rec(`r-${i}`, false);
      events.push(
        evt(`emit-${i}`, r.recommendationId, 'AI_RECOMMENDATION_EMITTED', new Date(start + i * 60_000).toISOString()),
      );
      events.push(
        evt(`acc-${i}`, r.recommendationId, 'AI_RECOMMENDATION_ACCEPTED', new Date(start + i * 60_000 + 500).toISOString(), {
          reviewerActor: reviewer,
          ambiguityAcknowledged: true,
          dwellMs: 500,
        }),
      );
    }
    const report = detectAutomationBias(events);
    const dwell = report.findings.find((f) => f.signal === 'low_dwell');
    expect(dwell).toBeDefined();
    expect(dwell!.severity).toBe('red');
  });
});

describe('humanAiIntegrity — chaos: ambiguity ignore', () => {
  it('all accepts on ambiguous recommendations without acknowledgement raises red ambiguity_ignore', () => {
    const events: LineageEvent[] = [];
    const start = Date.parse('2026-05-09T10:00:00.000Z');
    for (let i = 0; i < 20; i += 1) {
      const r = rec(`r-${i}`, true);
      events.push(
        evt(`emit-${i}`, r.recommendationId, 'AI_RECOMMENDATION_EMITTED', new Date(start + i * 60_000).toISOString()),
      );
      events.push(
        evt(`acc-${i}`, r.recommendationId, 'AI_RECOMMENDATION_ACCEPTED', new Date(start + i * 60_000 + 30_000).toISOString(), {
          reviewerActor: reviewer,
          ambiguityAcknowledged: false,
          dwellMs: 30_000,
        }),
      );
    }
    const report = detectAutomationBias(events);
    const ambig = report.findings.find((f) => f.signal === 'ambiguity_ignore');
    expect(ambig).toBeDefined();
    expect(ambig!.severity).toBe('red');
  });
});

describe('humanAiIntegrity — chaos: healthy traffic baseline', () => {
  it('mixed accept/override with reasonable dwell raises no findings', () => {
    const events: LineageEvent[] = [];
    const start = Date.parse('2026-05-09T10:00:00.000Z');
    for (let i = 0; i < 20; i += 1) {
      const r = rec(`r-${i}`, i % 4 === 0);
      const isOverride = i % 3 === 0;
      events.push(
        evt(`emit-${i}`, r.recommendationId, 'AI_RECOMMENDATION_EMITTED', new Date(start + i * 5 * 60_000).toISOString()),
      );
      if (isOverride) {
        events.push(
          evt(
            `ovr-${i}`,
            r.recommendationId,
            'AI_RECOMMENDATION_OVERRIDDEN',
            new Date(start + i * 5 * 60_000 + 90_000).toISOString(),
            {
              reviewerActor: reviewer,
              humanDecisionAction: 'reroute',
              humanDecisionReason: 'Different jurisdiction',
              dwellMs: 90_000,
            },
          ),
        );
      } else {
        events.push(
          evt(`acc-${i}`, r.recommendationId, 'AI_RECOMMENDATION_ACCEPTED', new Date(start + i * 5 * 60_000 + 60_000).toISOString(), {
            reviewerActor: reviewer,
            ambiguityAcknowledged: true,
            dwellMs: 60_000,
          }),
        );
      }
    }
    const report = detectAutomationBias(events);
    expect(report.worstSeverity).toBe('green');
    expect(report.findings).toHaveLength(0);
  });
});

describe('humanAiIntegrity — chaos: small windows do not produce false positives', () => {
  it('a window below minWindowSize returns no findings even on adversarial data', () => {
    const events: LineageEvent[] = [];
    const start = Date.parse('2026-05-09T10:00:00.000Z');
    for (let i = 0; i < 5; i += 1) {
      const r = rec(`r-${i}`, true);
      events.push(
        evt(`emit-${i}`, r.recommendationId, 'AI_RECOMMENDATION_EMITTED', new Date(start + i * 1000).toISOString()),
      );
      events.push(
        evt(`acc-${i}`, r.recommendationId, 'AI_RECOMMENDATION_ACCEPTED', new Date(start + i * 1000 + 100).toISOString(), {
          reviewerActor: reviewer,
          ambiguityAcknowledged: false,
          dwellMs: 100,
        }),
      );
    }
    const report = detectAutomationBias(events);
    expect(report.findings).toHaveLength(0);
    expect(report.worstSeverity).toBe('green');
  });
});

describe('humanAiIntegrity — chaos: dissent drought without rubber-stamp', () => {
  it('100 well-paced accepts with no overrides raises dissent_drought without rubber_stamp_velocity', () => {
    const events: LineageEvent[] = [];
    const start = Date.parse('2026-05-09T10:00:00.000Z');
    for (let i = 0; i < 100; i += 1) {
      const r = rec(`r-${i}`, false);
      const emittedAt = new Date(start + i * 5 * 60_000).toISOString();
      const acceptedAt = new Date(start + i * 5 * 60_000 + 60_000).toISOString();
      events.push(evt(`emit-${i}`, r.recommendationId, 'AI_RECOMMENDATION_EMITTED', emittedAt));
      events.push(
        evt(`acc-${i}`, r.recommendationId, 'AI_RECOMMENDATION_ACCEPTED', acceptedAt, {
          reviewerActor: reviewer,
          ambiguityAcknowledged: true,
          dwellMs: 60_000,
        }),
      );
    }
    const report = detectAutomationBias(events);
    expect(report.findings.some((f) => f.signal === 'dissent_drought')).toBe(true);
    expect(report.findings.some((f) => f.signal === 'rubber_stamp_velocity')).toBe(false);
  });
});
