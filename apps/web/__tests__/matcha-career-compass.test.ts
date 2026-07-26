/**
 * Career Compass (Wave 4, Part 1) — truth-model unit tests.
 *
 * Pins the honesty invariants: the next action is chosen deterministically by
 * priority, impact is stated as real counts (never fabricated deltas),
 * confidence tracks data coverage (High only with a readiness snapshot), absent
 * signals become explicit empty states, and no banned/estimative copy appears.
 */
import { describe, expect, it } from 'vitest';

import { buildCareerCompass, type CompassInput } from '@/lib/matcha/careerCompass';

function base(overrides: Partial<CompassInput> = {}): CompassInput {
  return {
    readiness: { score: 78, level: 'L3 · Clinical' },
    recognition: { state: 'none_recorded' },
    opportunities: { total: 5, clearedToApply: 2 },
    profileScore: 60,
    blockers: [],
    recommendedAction: null,
    ...overrides,
  };
}

describe('buildCareerCompass — metrics from real signals', () => {
  it('renders readiness / recognition / roles / profile from the inputs', () => {
    const m = buildCareerCompass(base()).metrics;
    expect(m.find((x) => x.key === 'readiness')!.value).toBe('78%');
    expect(m.find((x) => x.key === 'roles')!.value).toBe('2');
    expect(m.find((x) => x.key === 'roles')!.sub).toBe('of 5 matched');
    expect(m.find((x) => x.key === 'profile')!.value).toBe('60%');
  });

  it('shows honest empty states when signals are absent (no fabricated numbers)', () => {
    const m = buildCareerCompass(
      base({ readiness: null, recognition: { state: 'unavailable' }, opportunities: { total: 0, clearedToApply: 0 }, profileScore: null }),
    ).metrics;
    expect(m.find((x) => x.key === 'readiness')!.value).toBe('—');
    expect(m.find((x) => x.key === 'readiness')!.tone).toBe('empty');
    expect(m.find((x) => x.key === 'recognition')!.tone).toBe('unavailable');
    expect(m.find((x) => x.key === 'profile')!.value).toBe('—');
  });
});

describe('buildCareerCompass — deterministic next action by priority', () => {
  it('prioritizes an open readiness item, with real-count impact', () => {
    const compass = buildCareerCompass(
      base({
        blockers: [
          { title: 'License renewal', detail: 'Your license expires soon.', href: '/holder/blockers/lic', nextActionLabel: 'Renew now' },
          { title: 'Upload DEA', detail: 'DEA on file is pending.', href: '/holder/blockers/dea', nextActionLabel: 'Upload' },
        ],
        opportunities: { total: 5, clearedToApply: 2 },
      }),
    );
    expect(compass.action.title).toBe('Resolve: License renewal');
    expect(compass.action.href).toBe('/holder/blockers/lic');
    expect(compass.action.ctaLabel).toBe('Renew now');
    // Impact is real counts, not invented deltas.
    expect(compass.action.impact[0]).toBe('Clears 1 of your 2 open readiness items');
    expect(compass.action.impact.join(' ')).toContain('3 of your 5 matched roles');
  });

  it('falls back to the recommended action when there are no blockers', () => {
    const compass = buildCareerCompass(
      base({ blockers: [], recommendedAction: { title: 'Open your passport', description: 'Share it.', href: '/holder', ctaLabel: 'Open' } }),
    );
    expect(compass.action.title).toBe('Open your passport');
    expect(compass.action.href).toBe('/holder');
  });

  it('suggests finishing the profile when incomplete and nothing else pending', () => {
    const compass = buildCareerCompass(base({ blockers: [], recommendedAction: null, profileScore: 60 }));
    expect(compass.action.title).toBe('Complete your profile');
    expect(compass.action.impact.join(' ')).toContain('60% complete');
  });

  it('points to cleared roles when profile is complete and nothing is blocking', () => {
    const compass = buildCareerCompass(
      base({ blockers: [], recommendedAction: null, profileScore: 100, opportunities: { total: 4, clearedToApply: 3 } }),
    );
    expect(compass.action.title).toContain('Apply to 3 roles');
  });

  it('degrades to keep-current when everything is done', () => {
    const compass = buildCareerCompass(
      base({ blockers: [], recommendedAction: null, profileScore: 100, opportunities: { total: 0, clearedToApply: 0 } }),
    );
    expect(compass.action.title).toBe('Keep your readiness current');
  });
});

describe('buildCareerCompass — confidence tracks data coverage, not invention', () => {
  it('is High only when a readiness snapshot exists', () => {
    expect(buildCareerCompass(base({ readiness: { score: 70, level: 'L2' } })).action.confidence).toBe('High');
    expect(buildCareerCompass(base({ readiness: null })).action.confidence).toBe('Building');
  });

  it('never emits estimative or banned copy across states', () => {
    const banned = [
      /interview probability/i,
      /estimated salary/i,
      /\bverified\b/i,
      /guaranteed verification/i,
      /instant credentialing/i,
      /HIPAA compliant/i,
    ];
    const permutations: CompassInput[] = [
      base(),
      base({ readiness: null, recognition: { state: 'unavailable' }, opportunities: { total: 0, clearedToApply: 0 }, profileScore: null }),
      base({ blockers: [{ title: 'X', detail: 'Y', href: '/holder', nextActionLabel: 'Go' }] }),
      base({ recognition: { state: 'recognized', count: 3 } }),
    ];
    for (const input of permutations) {
      const c = buildCareerCompass(input);
      const text = [c.note, c.action.title, c.action.why, c.action.confidenceReason, ...c.action.impact, ...c.metrics.flatMap((m) => [m.label, m.value, m.sub])].join(' | ');
      for (const re of banned) {
        expect(re.test(text), `banned ${re} in: ${text}`).toBe(false);
      }
    }
  });
});
