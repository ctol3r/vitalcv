/**
 * orderByConfidence — deterministic confidence ordering contract.
 *
 * ProfileView depends on the invariant that sorting happens at the DATA layer,
 * not in render. These tests pin the contract: verified → inferred → unknown,
 * stable ties, immutability of input, and entry-preserving variant.
 *
 * If this file starts failing, do NOT "fix" it by swapping in a different sort.
 * The order is compliance posture, not style — treat a red test here as a
 * product-level question.
 */

import { describe, expect, it } from 'vitest';

import {
  CONFIDENCE_ORDER,
  orderByConfidence,
  orderEntriesByConfidence,
} from '@/lib/profile/orderByConfidence';

// Minimal ranked shape — orderByConfidence only reads `.type`, so we stub
// everything else. Using a tagged name field makes ties easy to assert.
interface Ranked {
  readonly name: string;
  readonly type: 'verified' | 'inferred' | 'unknown';
}

const v = (name: string): Ranked => ({ name, type: 'verified' });
const i = (name: string): Ranked => ({ name, type: 'inferred' });
const u = (name: string): Ranked => ({ name, type: 'unknown' });

describe('CONFIDENCE_ORDER', () => {
  it('is the single source of truth for rank order', () => {
    // Pin the literal so accidental reordering is caught loudly.
    expect(CONFIDENCE_ORDER).toEqual(['verified', 'inferred', 'unknown']);
  });
});

describe('orderByConfidence', () => {
  it('returns empty array for empty input', () => {
    expect(orderByConfidence([])).toEqual([]);
  });

  it('preserves single-item input', () => {
    const item = v('npi');
    expect(orderByConfidence([item])).toEqual([item]);
  });

  it('sorts verified before inferred before unknown', () => {
    const out = orderByConfidence([u('notes'), i('specialty'), v('npi')]);
    expect(out.map((x) => x.name)).toEqual(['npi', 'specialty', 'notes']);
  });

  it('is stable within a rank — ties preserve input order', () => {
    // Same rank, distinct names. Stable sort must not permute them.
    const out = orderByConfidence([
      v('first'),
      v('second'),
      v('third'),
      i('alpha'),
      i('beta'),
      u('zzz'),
    ]);
    expect(out.map((x) => x.name)).toEqual([
      'first',
      'second',
      'third',
      'alpha',
      'beta',
      'zzz',
    ]);
  });

  it('does not mutate the input array', () => {
    const input: Ranked[] = [u('a'), v('b'), i('c')];
    const snapshot = [...input];
    orderByConfidence(input);
    expect(input).toEqual(snapshot);
  });

  it('handles all-same-rank inputs without reordering', () => {
    const out = orderByConfidence([i('a'), i('b'), i('c')]);
    expect(out.map((x) => x.name)).toEqual(['a', 'b', 'c']);
  });

  it('handles mixed ranks with duplicate names across ranks', () => {
    // Same display name, different confidence — they MUST split by rank.
    const out = orderByConfidence([
      i('license'),
      v('license'),
      u('license'),
    ]);
    expect(out.map((x) => x.type)).toEqual(['verified', 'inferred', 'unknown']);
  });
});

describe('orderEntriesByConfidence', () => {
  it('returns empty array for empty input', () => {
    expect(orderEntriesByConfidence([])).toEqual([]);
  });

  it('sorts tuples by view rank and preserves keys', () => {
    const out = orderEntriesByConfidence([
      ['notes', u('notes')],
      ['specialty', i('specialty')],
      ['npi', v('npi')],
    ] as const);
    expect(out.map(([k]) => k)).toEqual(['npi', 'specialty', 'notes']);
  });

  it('is stable within a rank for tuples', () => {
    const out = orderEntriesByConfidence([
      ['a', v('a')],
      ['b', v('b')],
      ['c', i('c')],
      ['d', i('d')],
    ] as const);
    expect(out.map(([k]) => k)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not mutate the input tuple array', () => {
    const input = [
      ['a', u('a')],
      ['b', v('b')],
    ] as const;
    const snapshot = [...input];
    orderEntriesByConfidence(input);
    expect(input).toEqual(snapshot);
  });
});
