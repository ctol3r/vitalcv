/**
 * A2.3 gate — deadlines carry provenance, change urgency rather than
 * creating blockers, and cannot be phrased as facts they do not support.
 */
import { describe, expect, it } from 'vitest';
import { deriveDeadlines, urgencyForRef } from '@/lib/agent/deadlines/derive';
import { describeDeadline, isFactualDeadline, urgencyFor } from '@/lib/agent/deadlines/types';
import { scanTextForForbiddenClaims } from '@/lib/agent/forbidden-claims';
import { generateStartPlanV2 } from '@/lib/agent/policy/start-policy-v2';
import { ctx, lane } from '@/lib/agent/bench/temporal-scenarios';

const NOW = '2026-08-08T00:00:00.000Z';

function withLane(overrides: Parameters<typeof lane> extends never ? never : Record<string, unknown>) {
  return overrides;
}

describe('provenance is mandatory and unambiguous', () => {
  it('derives our freshness window as vitalcv_policy, never as the source date', () => {
    const context = ctx(NOW, {
      observations: [{ ...lane('state_license:VA', 'current', NOW), freshnessWindowDays: 90 }],
    });
    const deadlines = deriveDeadlines(context);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].provenance).toBe('vitalcv_policy');
    expect(isFactualDeadline(deadlines[0].provenance)).toBe(false);
  });

  it('derives a source-set deadline only from an explicitly provenanced field', () => {
    const context = ctx(NOW, {
      observations: [
        {
          ...lane('state_license:VA', 'current', NOW),
          freshnessWindowDays: 90,
          sourceExpiresAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    });
    const deadlines = deriveDeadlines(context);
    const source = deadlines.filter((d) => d.provenance === 'source_set');
    const policy = deadlines.filter((d) => d.provenance === 'vitalcv_policy');
    // Both exist and stay distinct — the whole point.
    expect(source).toHaveLength(1);
    expect(policy).toHaveLength(1);
    expect(source[0].at).toBe('2026-09-01T00:00:00.000Z');
    expect(source[0].setBy).toBe('state_license:VA authority');
  });

  it('derives an employer-set deadline only from the field that is actually written', () => {
    const context = ctx(NOW, {
      role: {
        roleRef: 'r1',
        employerRef: 'e1',
        applicationState: 'submitted',
        requirements: [],
        employerDueAt: '2026-08-20T00:00:00.000Z',
      },
    });
    const employer = deriveDeadlines(context).filter((d) => d.provenance === 'employer_set');
    expect(employer).toHaveLength(1);
    expect(isFactualDeadline(employer[0].provenance)).toBe(true);
  });

  it('derives nothing when there is neither a window nor a published date', () => {
    const context = ctx(NOW, {
      observations: [{ ...lane('state_license:VA', 'current', NOW), freshnessWindowDays: undefined }],
    });
    expect(deriveDeadlines(context)).toEqual([]);
  });
});

describe('rendering keeps the two sentences apart', () => {
  it('a policy window says it is ours and disclaims the authority', () => {
    const text = describeDeadline({
      provenance: 'vitalcv_policy',
      at: '2026-08-20T00:00:00.000Z',
      ref: 'state_license:VA',
      setBy: 'Virginia Board of Medicine',
    });
    expect(text).toContain("VitalCV's own preferred freshness window");
    expect(text).toContain('not a date from the authority');
    // It must not read as a statement about the clinician's licence.
    expect(text).not.toMatch(/your (licen[cs]e|credential) expires/i);
  });

  it('a source-set date is attributed to the authority', () => {
    const text = describeDeadline({
      provenance: 'source_set',
      at: '2026-09-01T00:00:00.000Z',
      ref: 'state_license:VA',
      setBy: 'Virginia Board of Medicine',
    });
    expect(text).toContain('Virginia Board of Medicine records this');
  });

  it('an estimate carries its qualifier inside the value', () => {
    const text = describeDeadline({
      provenance: 'estimated',
      at: '2026-09-01T00:00:00.000Z',
      ref: 'x',
      setBy: 'VitalCV',
      qualifier: 'based on typical renewal cycles',
    });
    expect(text).toContain('Estimated');
    expect(text).toContain('based on typical renewal cycles');
    expect(text).toContain('not a published date');
  });
});

describe('the phrasing guard is structural', () => {
  const policyOnly = ctx(NOW, {
    observations: [{ ...lane('state_license:VA', 'current', NOW), freshnessWindowDays: 90 }],
  });
  const sourceBacked = ctx(NOW, {
    observations: [
      {
        ...lane('state_license:VA', 'current', NOW),
        freshnessWindowDays: 90,
        sourceExpiresAt: '2026-09-01T00:00:00.000Z',
      },
    ],
  });

  it('refuses "your license expires" when only a policy window exists', () => {
    const hits = scanTextForForbiddenClaims('Your license expires soon.', policyOnly);
    expect(hits.map((h) => h.code)).toContain('expiry_stated_as_fact');
  });

  it('permits it once a source-set deadline exists', () => {
    const hits = scanTextForForbiddenClaims('Your license expires on 2026-09-01.', sourceBacked);
    expect(hits.map((h) => h.code)).not.toContain('expiry_stated_as_fact');
  });

  it('permits the policy phrasing in either case', () => {
    const sentence = describeDeadline({
      provenance: 'vitalcv_policy',
      at: '2026-08-20T00:00:00.000Z',
      ref: 'state_license:VA',
      setBy: 'Virginia Board of Medicine',
    });
    expect(scanTextForForbiddenClaims(sentence, policyOnly)).toEqual([]);
  });
});

describe('urgency, not blockers', () => {
  it('classifies by distance from now', () => {
    const d = (at: string) =>
      urgencyFor({ provenance: 'source_set', at, ref: 'x', setBy: 'y' }, NOW);
    expect(d('2026-08-01T00:00:00.000Z')).toBe('passed');
    expect(d('2026-08-15T00:00:00.000Z')).toBe('imminent');
    expect(d('2026-09-15T00:00:00.000Z')).toBe('approaching');
    expect(d('2027-08-15T00:00:00.000Z')).toBe('none');
  });

  it('prefers the source-set deadline over our window at the same urgency', () => {
    const deadlines = deriveDeadlines(
      ctx(NOW, {
        observations: [
          {
            ...lane('state_license:VA', 'stale', NOW),
            freshnessWindowDays: 10,
            sourceExpiresAt: '2026-08-14T00:00:00.000Z',
          },
        ],
      }),
    );
    const urgency = urgencyForRef(deadlines, 'state_license:VA', NOW);
    expect(urgency?.level).toBe('imminent');
    // When both are imminent, the one that is actually about the credential
    // is the one worth saying.
    expect(urgency?.deadline.provenance).toBe('source_set');
  });

  it('attaches urgency to an existing blocker WITHOUT creating a new one', () => {
    const base = ctx(NOW, { observations: [lane('state_license:VA', 'stale', NOW)] });
    const withDeadline = ctx(NOW, {
      observations: [
        { ...lane('state_license:VA', 'stale', NOW), sourceExpiresAt: '2026-08-15T00:00:00.000Z' },
      ],
    });

    const plain = generateStartPlanV2(base, { now: NOW });
    const urgent = generateStartPlanV2(withDeadline, { now: NOW });

    // Identical blocker SETS — a deadline is not a blocker.
    expect(urgent.blockers.map((b) => b.type).sort()).toEqual(
      plain.blockers.map((b) => b.type).sort(),
    );
    expect(urgent.blockers).toHaveLength(plain.blockers.length);

    // …but the urgency is now attached.
    const stale = urgent.blockers.find((b) => b.type === 'stale_source_observation')!;
    expect(stale.urgency?.level).toBe('imminent');
    expect(stale.urgency?.deadline.provenance).toBe('source_set');
    expect(plain.blockers.find((b) => b.type === 'stale_source_observation')!.urgency).toBeUndefined();
  });

  it('ranks the more urgent of two same-tier actions first', () => {
    const context = ctx(NOW, {
      observations: [
        { ...lane('state_license:MD', 'stale', NOW), sourceExpiresAt: '2027-01-01T00:00:00.000Z' },
        { ...lane('state_license:VA', 'stale', NOW), sourceExpiresAt: '2026-08-10T00:00:00.000Z' },
      ],
    });
    const plan = generateStartPlanV2(context, { now: NOW });
    const top = plan.actions.find((a) => a.id === plan.rankedActionIds[0])!;
    // Both are tier-2 VitalCV refreshes; VA is imminent, MD is not.
    expect(top.type).toBe('refresh_source_observation');
    expect(top.target?.laneId).toBe('state_license:VA');
  });

  it('does not let urgency jump a tier', () => {
    // An urgent optional lane must not outrank work that blocks an
    // application. Urgency orders within a tier; it never reorders the tiers.
    const context = ctx(NOW, {
      role: {
        roleRef: 'r1',
        employerRef: 'e1',
        applicationState: 'in_progress',
        requirements: [
          {
            id: 'req-1',
            kind: 'employer_controlled',
            controlledBy: 'employer',
            satisfied: false,
            evidenceRefs: [],
          },
        ],
      },
      observations: [
        { ...lane('state_license:VA', 'stale', NOW), sourceExpiresAt: '2026-08-09T00:00:00.000Z' },
      ],
    });
    const plan = generateStartPlanV2(context, { now: NOW });
    const top = plan.actions.find((a) => a.id === plan.rankedActionIds[0])!;
    expect(top.rankTier).toBe(1);
    expect(top.type).toBe('await_employer_decision');
  });
});
