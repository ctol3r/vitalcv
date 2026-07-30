/**
 * regulatory-freshness.test.ts — W3 regulator-anchored freshness evaluator.
 *
 * The evaluator is pure and `now`-injected. Guards the tone boundaries
 * (current/aging/stale/expired/unknown), window-relative escalation,
 * next-due derivation, determinism, and honest (non-banned) consequence copy.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateRegulatoryFreshness,
  REGULATORY_WINDOWS,
  freshnessToneToken,
} from '@/lib/freshness/regulatoryWindows';

const NOW = '2026-07-18T00:00:00Z';
const PSV = REGULATORY_WINDOWS.primarySourceVerification; // 90d
const SANCTION = REGULATORY_WINDOWS.sanctionScreening; // 30d

function daysBefore(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() - days * 86_400_000).toISOString();
}

const BANNED = /\bverified\b|\bguaranteed verification\b|\bHIPAA compliant\b|\bSOC2 certified\b/i;

describe('evaluateRegulatoryFreshness — tone boundaries', () => {
  it('current when well within the window', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: daysBefore(NOW, 10), window: PSV, now: NOW });
    expect(f.tone).toBe('current');
    expect(f.ageDays).toBe(10);
    expect(f.remainingDays).toBe(80);
  });

  it('aging once past the halfway point of the window', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: daysBefore(NOW, 60), window: PSV, now: NOW });
    expect(f.tone).toBe('aging');
    expect(f.remainingDays).toBe(30);
  });

  it('stale once past the window but under 1.5x', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: daysBefore(NOW, 100), window: PSV, now: NOW });
    expect(f.tone).toBe('stale');
    expect(f.remainingDays).toBeLessThan(0);
    expect(f.consequence.toLowerCase()).toContain('acceptance pauses');
  });

  it('expired once beyond 1.5x the window', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: daysBefore(NOW, 140), window: PSV, now: NOW });
    expect(f.tone).toBe('expired');
  });

  it('unknown when never checked (null age/remaining/nextDue)', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: null, window: PSV, now: NOW });
    expect(f.tone).toBe('unknown');
    expect(f.ageDays).toBeNull();
    expect(f.remainingDays).toBeNull();
    expect(f.nextDueAt).toBeNull();
    expect(f.escalation).toBe('none');
  });
});

describe('evaluateRegulatoryFreshness — escalation & derivation', () => {
  it('escalation is window-relative (a 30d window does not read urgent at 25d out)', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: daysBefore(NOW, 5), window: SANCTION, now: NOW });
    // 25/30 remaining -> well inside -> no escalation
    expect(f.escalation).toBe('none');
  });

  it('escalates to urgent near the end of the window', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: daysBefore(NOW, 28), window: SANCTION, now: NOW });
    expect(f.escalation).toBe('urgent'); // 2/30 remaining
  });

  it('derives next-due as checkedAt + windowDays', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: '2026-06-01T00:00:00Z', window: PSV, now: NOW });
    expect(f.nextDueAt).toBe('2026-08-30'); // +90d
  });

  it('carries the regulator code', () => {
    const f = evaluateRegulatoryFreshness({ checkedAt: daysBefore(NOW, 1), window: PSV, now: NOW });
    expect(f.code).toBe('NCQA CR.4');
  });
});

describe('evaluateRegulatoryFreshness — purity & honesty', () => {
  it('is deterministic for the same inputs (now injected, no Date.now)', () => {
    const args = { checkedAt: daysBefore(NOW, 45), window: PSV, now: NOW } as const;
    expect(evaluateRegulatoryFreshness(args)).toEqual(evaluateRegulatoryFreshness(args));
  });

  it('every window produces banned-string-free consequence copy across all tones', () => {
    for (const window of Object.values(REGULATORY_WINDOWS)) {
      for (const age of [1, window.windowDays * 0.7, window.windowDays + 5, window.windowDays * 2]) {
        const f = evaluateRegulatoryFreshness({ checkedAt: daysBefore(NOW, age), window, now: NOW });
        expect(BANNED.test(f.consequence), `banned copy for ${window.id}: ${f.consequence}`).toBe(false);
      }
      const unknown = evaluateRegulatoryFreshness({ checkedAt: null, window, now: NOW });
      expect(BANNED.test(unknown.consequence)).toBe(false);
    }
  });

  it('maps tones to Calm Wave state tokens', () => {
    expect(freshnessToneToken('current')).toContain('--vt-state-source-confirmed');
    expect(freshnessToneToken('stale')).toContain('--vt-state-blocked');
    expect(freshnessToneToken('unknown')).toContain('--vt-state-unknown');
  });
});
