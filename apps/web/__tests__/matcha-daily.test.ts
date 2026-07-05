import { describe, expect, it } from 'vitest';

import {
  advanceStreak,
  buildBriefItems,
  daysBetween,
  gapNudge,
  toISODate,
  trustEventNotes,
  type DailyDelta,
  type TrustHistoryEventLike,
} from '../lib/matcha/daily';

const EMPTY: DailyDelta = {
  newMatches: 0,
  savedMatches: 0,
  readinessScore: null,
  readinessDelta: null,
  completeness: 100,
  memoryNotes: [],
};

describe('daily — streak math', () => {
  it('is unchanged on a repeat visit the same day', () => {
    const s = { streak: 4, lastVisit: '2026-07-04' };
    expect(advanceStreak(s, '2026-07-04')).toBe(s);
  });

  it('increments on a consecutive day', () => {
    expect(advanceStreak({ streak: 4, lastVisit: '2026-07-03' }, '2026-07-04')).toEqual({ streak: 5, lastVisit: '2026-07-04' });
  });

  it('resets to 1 after a gap', () => {
    expect(advanceStreak({ streak: 9, lastVisit: '2026-07-01' }, '2026-07-04')).toEqual({ streak: 1, lastVisit: '2026-07-04' });
  });

  it('starts at 1 on the first ever visit', () => {
    expect(advanceStreak({ streak: 0, lastVisit: null }, '2026-07-04')).toEqual({ streak: 1, lastVisit: '2026-07-04' });
  });

  it('computes whole-day gaps and formats ISO dates', () => {
    expect(daysBetween('2026-07-01', '2026-07-04')).toBe(3);
    expect(toISODate(new Date('2026-07-04T09:30:00'))).toBe('2026-07-04');
  });
});

describe('daily — brief items are grounded in real deltas', () => {
  it('shows a calm "nothing new" line when nothing moved', () => {
    const items = buildBriefItems(EMPTY);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('quiet');
  });

  it('surfaces new matches, readiness gains, and edits — in order, honestly', () => {
    const items = buildBriefItems({
      newMatches: 3,
      savedMatches: 1,
      readinessScore: 72,
      readinessDelta: 6,
      completeness: 40,
      memoryNotes: ['You updated where you want to work to CA, WA.'],
      gapNudge: 'A few more Place answers sharpen your matches',
    });
    const ids = items.map((i) => i.id);
    expect(ids[0]).toBe('new-matches');
    expect(items.find((i) => i.id === 'new-matches')!.text).toContain('3 new roles');
    expect(items.find((i) => i.id === 'readiness')!.text).toContain('up 6 to 72/100');
    expect(items.some((i) => i.text.includes('where you want to work'))).toBe(true);
    expect(items.some((i) => i.id === 'saved')).toBe(true);
    expect(items.some((i) => i.id === 'gap')).toBe(true);
    // never more than 5
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it('does not invent readiness movement when delta is zero or unknown', () => {
    expect(buildBriefItems({ ...EMPTY, readinessScore: 70, readinessDelta: 0 }).some((i) => i.id === 'readiness')).toBe(false);
    expect(buildBriefItems({ ...EMPTY, readinessScore: 70, readinessDelta: null }).some((i) => i.id === 'readiness')).toBe(false);
  });

  it('marks a readiness drop as neutral, not celebratory', () => {
    const item = buildBriefItems({ ...EMPTY, readinessScore: 64, readinessDelta: -4 }).find((i) => i.id === 'readiness')!;
    expect(item.tone).toBe('neutral');
  });
});

describe('daily — source-refresh events from trust history', () => {
  const entry = (over: Partial<TrustHistoryEventLike>): TrustHistoryEventLike => ({
    computedAt: '2026-07-04T09:00:00.000Z',
    deltaScore: null,
    newGaps: [],
    resolvedGaps: [],
    reason: null,
    ...over,
  });

  it('emits nothing on a first-ever visit (no baseline) — old history is not "news"', () => {
    expect(trustEventNotes([entry({})], null)).toHaveLength(0);
  });

  it('includes only events strictly after the previous visit day', () => {
    const events = [
      entry({ computedAt: '2026-07-01T10:00:00.000Z', reason: 'old check' }),
      entry({ computedAt: '2026-07-04T10:00:00.000Z', reason: 'License re-checked with the state board' }),
    ];
    const notes = trustEventNotes(events, '2026-07-02');
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toContain('state board');
  });

  it('phrases resolved gaps as wins and new gaps as nudges', () => {
    const resolved = trustEventNotes([entry({ resolvedGaps: ['DEA registration confirmed'] })], '2026-07-02')[0];
    expect(resolved.tone).toBe('up');
    expect(resolved.text).toContain('DEA registration confirmed');
    const flagged = trustEventNotes([entry({ newGaps: ['License expiring soon'] })], '2026-07-02')[0];
    expect(flagged.tone).toBe('nudge');
  });

  it('falls back to a plain re-check line and caps at 2', () => {
    const notes = trustEventNotes([entry({}), entry({}), entry({})], '2026-07-02');
    expect(notes).toHaveLength(2);
    expect(notes[0].text).toBe('Your sources were re-checked');
  });

  it('source events appear in the brief between readiness and memory notes', () => {
    const items = buildBriefItems({
      ...EMPTY,
      completeness: 50,
      readinessScore: 70,
      readinessDelta: 3,
      sourceEvents: [{ text: 'Resolved since your last visit: DEA registration confirmed', tone: 'up' }],
      memoryNotes: ['You updated your target compensation.'],
    });
    const ids = items.map((i) => i.id);
    expect(ids.indexOf('readiness')).toBeLessThan(ids.findIndex((id) => id.startsWith('src-')));
    expect(ids.findIndex((id) => id.startsWith('src-'))).toBeLessThan(ids.findIndex((id) => id.startsWith('mem-')));
  });
});

describe('daily — gap nudge', () => {
  it('returns null when the profile is full', () => {
    expect(gapNudge(100, 'Place')).toBeNull();
  });
  it('phrases a nudge from the thinnest category', () => {
    expect(gapNudge(40, 'Professional')).toContain('Professional');
  });
});
