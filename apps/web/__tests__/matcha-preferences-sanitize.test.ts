/**
 * sanitizeStoredPreferences — the write-boundary guard for the durable MATCHA
 * preference store. Pins that only known preference fields survive, types are
 * enforced, sizes are bounded, and arbitrary/unknown input is dropped — so the
 * server store can never hold junk (or anything shaped like a credential claim).
 */
import { describe, expect, it } from 'vitest';

import { sanitizeStoredPreferences } from '@/lib/matcha/preferences';

describe('sanitizeStoredPreferences', () => {
  it('keeps known fields with valid typed values', () => {
    const out = sanitizeStoredPreferences({
      careerGoals: ['ICU', 'Leadership'],
      preferredStates: ['CA', 'WA'],
      minimumSalary: 180000,
      remoteInterest: 'prefer',
      researchInterest: 3,
      newGraduate: true,
    });
    expect(out.careerGoals).toEqual(['ICU', 'Leadership']);
    expect(out.preferredStates).toEqual(['CA', 'WA']);
    expect(out.minimumSalary).toBe(180000);
    expect(out.remoteInterest).toBe('prefer');
    expect(out.researchInterest).toBe(3);
    expect(out.newGraduate).toBe(true);
  });

  it('drops unknown keys entirely', () => {
    const out = sanitizeStoredPreferences({
      careerGoals: ['X'],
      __proto__pollution: 'nope',
      credentials_hack: ['MD'],
      evilBlob: { a: 1 },
      npi: '1234567890',
    }) as Record<string, unknown>;
    expect(out.careerGoals).toEqual(['X']);
    expect(out.credentials_hack).toBeUndefined();
    expect(out.evilBlob).toBeUndefined();
    expect(out.npi).toBeUndefined();
  });

  it('drops empty arrays, empty strings, and non-finite numbers', () => {
    const out = sanitizeStoredPreferences({
      careerGoals: [],
      remoteInterest: '   ',
      minimumSalary: Number.NaN,
      preferredStates: ['CA'],
    }) as Record<string, unknown>;
    expect(out.careerGoals).toBeUndefined();
    expect(out.remoteInterest).toBeUndefined();
    expect(out.minimumSalary).toBeUndefined();
    expect(out.preferredStates).toEqual(['CA']);
  });

  it('filters non-string items out of arrays', () => {
    const out = sanitizeStoredPreferences({ careerGoals: ['ICU', 42, null, { x: 1 }, 'OR'] });
    expect(out.careerGoals).toEqual(['ICU', 'OR']);
  });

  it('caps array length and string length', () => {
    const bigArray = Array.from({ length: 200 }, (_, i) => `item-${i}`);
    const longString = 'x'.repeat(1000);
    const out = sanitizeStoredPreferences({ certifications: bigArray, remoteInterest: longString });
    expect(out.certifications!.length).toBe(60);
    expect((out.remoteInterest as string).length).toBe(240);
  });

  it('returns an empty object for non-object input', () => {
    expect(sanitizeStoredPreferences(null)).toEqual({});
    expect(sanitizeStoredPreferences(undefined)).toEqual({});
    expect(sanitizeStoredPreferences('nope')).toEqual({});
    expect(sanitizeStoredPreferences(42)).toEqual({});
    expect(sanitizeStoredPreferences(['a', 'b'])).toEqual({});
  });

  it('is idempotent (sanitizing a sanitized bag is a fixed point)', () => {
    const once = sanitizeStoredPreferences({ careerGoals: ['ICU'], minimumSalary: 200000, garbage: 'x' });
    expect(sanitizeStoredPreferences(once)).toEqual(once);
  });
});
