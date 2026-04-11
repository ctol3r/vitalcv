/**
 * DATA CONFIDENCE ENGINE TESTS
 *
 * Invariants under test:
 *   1. Source weights match the published spec
 *   2. Classification is consistent with score + source
 *   3. ConfidenceField is immutable and always carries provenance
 *   4. No field can be rendered without a confidence wrapper
 */

import { describe, expect, it } from 'vitest';
import {
  AUTHORITATIVE_SOURCES,
  CONFIDENCE_SOURCE_VALUES,
  CONFIDENCE_TYPE_VALUES,
  ConfidenceError,
  INFERRED_THRESHOLD,
  SOURCE_LABELS,
  SOURCE_WEIGHTS,
  UNKNOWN_CONFIDENCE,
  VERIFIED_THRESHOLD,
  assertAllFieldsHaveConfidence,
  assertConfidenceValid,
  clampScore,
  classifyConfidence,
  confidenceField,
  fromSource,
  isConfidence,
  isConfidenceField,
  unknownField,
  type Confidence,
} from '../dataConfidence';

describe('source weights', () => {
  it('matches the published spec', () => {
    expect(SOURCE_WEIGHTS.NPPES).toBe(100);
    expect(SOURCE_WEIGHTS.STATE_BOARD).toBe(100);
    expect(SOURCE_WEIGHTS.USER_UPLOAD).toBe(80);
    expect(SOURCE_WEIGHTS.INFERENCE).toBe(60);
    expect(SOURCE_WEIGHTS.UNKNOWN).toBe(0);
  });

  it('has a weight for every declared source', () => {
    for (const source of CONFIDENCE_SOURCE_VALUES) {
      expect(SOURCE_WEIGHTS[source]).toBeGreaterThanOrEqual(0);
      expect(SOURCE_WEIGHTS[source]).toBeLessThanOrEqual(100);
    }
  });

  it('has a human label for every declared source', () => {
    for (const source of CONFIDENCE_SOURCE_VALUES) {
      expect(SOURCE_LABELS[source]).toBeTruthy();
    }
  });

  it('SOURCE_WEIGHTS is frozen', () => {
    expect(Object.isFrozen(SOURCE_WEIGHTS)).toBe(true);
  });

  it('authoritative sources list includes NPPES and STATE_BOARD', () => {
    expect(AUTHORITATIVE_SOURCES).toContain('NPPES');
    expect(AUTHORITATIVE_SOURCES).toContain('STATE_BOARD');
  });
});

describe('classifyConfidence', () => {
  it('classifies NPPES at 100 as verified', () => {
    expect(classifyConfidence('NPPES', 100)).toBe('verified');
  });

  it('classifies STATE_BOARD at VERIFIED_THRESHOLD as verified', () => {
    expect(classifyConfidence('STATE_BOARD', VERIFIED_THRESHOLD)).toBe('verified');
  });

  it('classifies NPPES just below VERIFIED_THRESHOLD as inferred', () => {
    expect(classifyConfidence('NPPES', VERIFIED_THRESHOLD - 1)).toBe('inferred');
  });

  it('classifies USER_UPLOAD at 80 as inferred (not authoritative)', () => {
    expect(classifyConfidence('USER_UPLOAD', 80)).toBe('inferred');
  });

  it('classifies INFERENCE at 60 as inferred', () => {
    expect(classifyConfidence('INFERENCE', 60)).toBe('inferred');
  });

  it('classifies below INFERRED_THRESHOLD as unknown', () => {
    expect(classifyConfidence('INFERENCE', INFERRED_THRESHOLD - 1)).toBe('unknown');
  });

  it('classifies UNKNOWN source as unknown regardless of score', () => {
    expect(classifyConfidence('UNKNOWN', 100)).toBe('unknown');
  });
});

describe('fromSource', () => {
  it('seeds score from SOURCE_WEIGHTS by default', () => {
    const c = fromSource('NPPES');
    expect(c.score).toBe(100);
    expect(c.type).toBe('verified');
    expect(c.source).toBe('NPPES');
  });

  it('allows score override', () => {
    const c = fromSource('INFERENCE', { score: 45 });
    expect(c.score).toBe(45);
    expect(c.type).toBe('unknown');
  });

  it('clamps overridden score to [0, 100]', () => {
    expect(fromSource('NPPES', { score: 150 }).score).toBe(100);
    expect(fromSource('NPPES', { score: -10 }).score).toBe(0);
  });

  it('preserves observedAt and reason', () => {
    const c = fromSource('USER_UPLOAD', {
      observedAt: '2026-04-10T00:00:00Z',
      reason: 'provider upload',
    });
    expect(c.observedAt).toBe('2026-04-10T00:00:00Z');
    expect(c.reason).toBe('provider upload');
  });

  it('returns a frozen object', () => {
    const c = fromSource('NPPES');
    expect(Object.isFrozen(c)).toBe(true);
  });
});

describe('confidenceField / unknownField', () => {
  it('wraps a value with its confidence', () => {
    const f = confidenceField('Dr. Jane Doe', fromSource('NPPES'));
    expect(f.value).toBe('Dr. Jane Doe');
    expect(f.confidence.type).toBe('verified');
    expect(f.source).toBe('NPPES');
  });

  it('unknownField wraps with UNKNOWN_CONFIDENCE sentinel', () => {
    const f = unknownField('legacy-value');
    expect(f.confidence).toBe(UNKNOWN_CONFIDENCE);
    expect(f.confidence.type).toBe('unknown');
  });

  it('returns a frozen field', () => {
    const f = confidenceField(1, fromSource('NPPES'));
    expect(Object.isFrozen(f)).toBe(true);
  });
});

describe('clampScore', () => {
  it('returns 0 for NaN', () => {
    expect(clampScore(Number.NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampScore(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('clamps negatives to 0', () => {
    expect(clampScore(-5)).toBe(0);
  });

  it('clamps > 100 to 100', () => {
    expect(clampScore(101)).toBe(100);
  });

  it('passes through valid scores', () => {
    expect(clampScore(73)).toBe(73);
  });
});

describe('isConfidence / isConfidenceField', () => {
  it('rejects null and primitives', () => {
    expect(isConfidence(null)).toBe(false);
    expect(isConfidence(undefined)).toBe(false);
    expect(isConfidence(42)).toBe(false);
    expect(isConfidence('NPPES')).toBe(false);
  });

  it('rejects objects missing required fields', () => {
    expect(isConfidence({})).toBe(false);
    expect(isConfidence({ source: 'NPPES' })).toBe(false);
    expect(isConfidence({ source: 'NPPES', type: 'verified' })).toBe(false);
  });

  it('rejects scores outside [0, 100]', () => {
    expect(
      isConfidence({ source: 'NPPES', type: 'verified', score: 101 }),
    ).toBe(false);
    expect(
      isConfidence({ source: 'NPPES', type: 'verified', score: -1 }),
    ).toBe(false);
  });

  it('rejects invalid source values', () => {
    expect(
      isConfidence({ source: 'FAKE', type: 'verified', score: 100 }),
    ).toBe(false);
  });

  it('rejects invalid type values', () => {
    expect(
      isConfidence({ source: 'NPPES', type: 'magic', score: 100 }),
    ).toBe(false);
  });

  it('accepts a well-formed Confidence', () => {
    expect(isConfidence(fromSource('NPPES'))).toBe(true);
  });

  it('isConfidenceField rejects non-objects', () => {
    expect(isConfidenceField(null)).toBe(false);
    expect(isConfidenceField(42)).toBe(false);
  });

  it('isConfidenceField rejects objects without value or confidence', () => {
    expect(isConfidenceField({ value: 'x' })).toBe(false);
    expect(isConfidenceField({ confidence: fromSource('NPPES') })).toBe(false);
  });

  it('isConfidenceField accepts a well-formed wrapper', () => {
    expect(isConfidenceField(confidenceField('x', fromSource('NPPES')))).toBe(
      true,
    );
  });
});

describe('assertConfidenceValid', () => {
  it('passes for a fromSource result', () => {
    expect(() => assertConfidenceValid(fromSource('NPPES'))).not.toThrow();
  });

  it('throws ConfidenceError on malformed shape', () => {
    expect(() => assertConfidenceValid({} as unknown as Confidence)).toThrow(
      ConfidenceError,
    );
  });

  it('throws ConfidenceError when type disagrees with score/source', () => {
    const tampered: Confidence = {
      source: 'INFERENCE',
      score: 60,
      type: 'verified', // lie
    };
    expect(() => assertConfidenceValid(tampered)).toThrow(ConfidenceError);
  });
});

describe('assertAllFieldsHaveConfidence (the UI gate)', () => {
  it('passes when every field is wrapped', () => {
    const payload = {
      name: confidenceField('Jane', fromSource('NPPES')),
      license: confidenceField('MD-123', fromSource('STATE_BOARD')),
    };
    expect(() => assertAllFieldsHaveConfidence(payload)).not.toThrow();
  });

  it('allows null/undefined values to be absent', () => {
    const payload = {
      name: confidenceField('Jane', fromSource('NPPES')),
      middleName: null,
      nickname: undefined,
    };
    expect(() => assertAllFieldsHaveConfidence(payload)).not.toThrow();
  });

  it('throws if any field is a bare value', () => {
    const payload = {
      name: confidenceField('Jane', fromSource('NPPES')),
      license: 'MD-123', // bare string — forbidden
    };
    expect(() => assertAllFieldsHaveConfidence(payload)).toThrow(
      ConfidenceError,
    );
  });

  it('throws if any field is an object without confidence metadata', () => {
    const payload = {
      name: { value: 'Jane' }, // missing confidence
    };
    expect(() => assertAllFieldsHaveConfidence(payload)).toThrow(
      ConfidenceError,
    );
  });

  it('error message names the offending field', () => {
    const payload = { license: 'bare' };
    expect(() => assertAllFieldsHaveConfidence(payload)).toThrow(/license/);
  });
});

describe('type & source value exports', () => {
  it('exports all declared confidence types', () => {
    expect(CONFIDENCE_TYPE_VALUES).toEqual(['verified', 'inferred', 'unknown']);
  });

  it('exports all declared sources', () => {
    expect(CONFIDENCE_SOURCE_VALUES).toContain('NPPES');
    expect(CONFIDENCE_SOURCE_VALUES).toContain('STATE_BOARD');
    expect(CONFIDENCE_SOURCE_VALUES).toContain('USER_UPLOAD');
    expect(CONFIDENCE_SOURCE_VALUES).toContain('INFERENCE');
    expect(CONFIDENCE_SOURCE_VALUES).toContain('UNKNOWN');
  });
});

describe('ConfidenceError', () => {
  it('is a named Error', () => {
    const err = new ConfidenceError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConfidenceError');
    expect(err.message).toBe('boom');
  });
});
