/**
 * Career Scoreboard (Wave 6) — truth-model unit tests.
 *
 * Pins the honest-by-construction behavior: real signals become real tiles,
 * absent signals become explicit empty states (never fabricated numbers), the
 * MATCHA-tuning tile is omitted when the pilot is off, and the board never
 * emits a banned truth-contract phrase or a bare "Verified" label.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCareerScoreboard,
  type ScoreboardInput,
} from '@/lib/matcha/scoreboard';

function baseInput(overrides: Partial<ScoreboardInput> = {}): ScoreboardInput {
  return {
    readiness: { score: 78, level: 'L3', status: 'Clinical' },
    recognition: { state: 'none_recorded' },
    opportunities: { total: 4, clearedToApply: 2 },
    applicationsInMotion: 1,
    profile: { score: 60, answered: 3, total: 5 },
    matchaTuning: { percent: 40 },
    blockers: 1,
    ...overrides,
  };
}

const BANNED = [
  /\bverified\b/i,
  /automatically verified/i,
  /guaranteed verification/i,
  /instant credentialing/i,
  /complete credentialing/i,
  /legally accepted/i,
  /risk transferred/i,
  /HIPAA compliant/i,
  /SOC2 certified/i,
  /certified compliant/i,
];

function allText(board: ReturnType<typeof buildCareerScoreboard>): string {
  return [
    board.headline,
    board.subhead,
    board.note,
    ...board.tiles.flatMap((t) => [t.label, t.value, t.detail, t.source, t.ctaLabel]),
  ].join(' | ');
}

describe('buildCareerScoreboard — real signals', () => {
  it('renders a source-backed readiness tile from a real snapshot', () => {
    const board = buildCareerScoreboard(baseInput());
    const readiness = board.tiles.find((t) => t.key === 'readiness')!;
    expect(readiness.value).toBe('78/100');
    expect(readiness.tone).toBe('strong');
    expect(readiness.href).toBe('/holder/readiness');
    expect(readiness.source).toBe('Source-backed readiness');
  });

  it('counts cleared-to-apply roles honestly against the total', () => {
    const board = buildCareerScoreboard(baseInput());
    const roles = board.tiles.find((t) => t.key === 'opportunities')!;
    expect(roles.value).toBe('2 ready');
    expect(roles.detail).toContain('2 cleared to apply');
    expect(roles.detail).toContain('4 matched');
  });

  it('shows recorded recognition when an acceptance exists', () => {
    const board = buildCareerScoreboard(baseInput({ recognition: { state: 'recognized', count: 3 } }));
    const rec = board.tiles.find((t) => t.key === 'recognition')!;
    expect(rec.value).toBe('3 recorded');
    expect(rec.tone).toBe('strong');
  });
});

describe('buildCareerScoreboard — honest empty / unavailable states (never invented)', () => {
  it('shows an empty readiness tile with no fabricated score when there is no snapshot', () => {
    const board = buildCareerScoreboard(baseInput({ readiness: null }));
    const readiness = board.tiles.find((t) => t.key === 'readiness')!;
    expect(readiness.value).toBe('—');
    expect(readiness.tone).toBe('empty');
    expect(readiness.detail).toMatch(/Add your NPI/i);
  });

  it('distinguishes "none recorded" from "unavailable" for recognition', () => {
    const none = buildCareerScoreboard(baseInput({ recognition: { state: 'none_recorded' } }));
    const unavailable = buildCareerScoreboard(baseInput({ recognition: { state: 'unavailable' } }));
    expect(none.tiles.find((t) => t.key === 'recognition')!.value).toBe('None yet');
    expect(none.tiles.find((t) => t.key === 'recognition')!.tone).toBe('empty');
    expect(unavailable.tiles.find((t) => t.key === 'recognition')!.tone).toBe('unavailable');
    expect(unavailable.tiles.find((t) => t.key === 'recognition')!.detail).toMatch(/system state/i);
  });

  it('shows an empty roles tile (not a zero claim) when nothing is live', () => {
    const board = buildCareerScoreboard(baseInput({ opportunities: { total: 0, clearedToApply: 0 } }));
    const roles = board.tiles.find((t) => t.key === 'opportunities')!;
    expect(roles.value).toBe('None live');
    expect(roles.tone).toBe('empty');
  });

  it('marks "what\'s left" clear when there are no blockers', () => {
    const board = buildCareerScoreboard(baseInput({ blockers: 0 }));
    const left = board.tiles.find((t) => t.key === 'whats-left')!;
    expect(left.value).toBe('Clear');
    expect(left.tone).toBe('strong');
  });
});

describe('buildCareerScoreboard — MATCHA tuning gating', () => {
  it('includes the tuning tile when preferences are available', () => {
    const board = buildCareerScoreboard(baseInput({ matchaTuning: { percent: 40 } }));
    expect(board.tiles.some((t) => t.key === 'matcha-tuning')).toBe(true);
  });

  it('omits the tuning tile entirely when the MATCHA pilot is off (null)', () => {
    const board = buildCareerScoreboard(baseInput({ matchaTuning: null }));
    expect(board.tiles.some((t) => t.key === 'matcha-tuning')).toBe(false);
  });

  it('always links every tile to a reachable route', () => {
    const board = buildCareerScoreboard(baseInput({ matchaTuning: null }));
    for (const tile of board.tiles) {
      expect(tile.href.startsWith('/')).toBe(true);
    }
  });
});

describe('buildCareerScoreboard — truth contract', () => {
  it('never emits a banned phrase or a bare "Verified" label across any state', () => {
    const permutations: ScoreboardInput[] = [
      baseInput(),
      baseInput({ readiness: null, recognition: { state: 'unavailable' }, opportunities: { total: 0, clearedToApply: 0 }, applicationsInMotion: 0, profile: null, matchaTuning: null, blockers: 0 }),
      baseInput({ recognition: { state: 'recognized', count: 5 }, blockers: 3, matchaTuning: { percent: 0 } }),
    ];
    for (const input of permutations) {
      const text = allText(buildCareerScoreboard(input));
      for (const pattern of BANNED) {
        expect(pattern.test(text), `banned pattern ${pattern} matched in: ${text}`).toBe(false);
      }
    }
  });

  it('keeps the honest omission note naming what is not shown', () => {
    const board = buildCareerScoreboard(baseInput());
    expect(board.note).toMatch(/omitted rather than invented/i);
  });
});
