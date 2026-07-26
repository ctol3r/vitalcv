import { describe, expect, it } from 'vitest';

import {
  bandDescriptor,
  buildPoolQuery,
  formatAvailability,
  readinessLabel,
} from '../lib/matcha/pool';

const NOW = Date.parse('2026-07-04T00:00:00.000Z');

describe('pool — filters & query', () => {
  it('builds a query only from set filters', () => {
    expect(buildPoolQuery({})).toBe('');
    expect(buildPoolQuery({ specialty: 'Cardiology', trustBand: 'L2' })).toBe('specialty=Cardiology&trustBand=L2');
    expect(buildPoolQuery({ state: 'CA', urgency: 'immediate' })).toBe('state=CA&urgency=immediate');
  });

  it('ignores blank filter values', () => {
    expect(buildPoolQuery({ specialty: '   ', state: '' })).toBe('');
  });
});

describe('pool — honest trust-band descriptors', () => {
  it('describes source coverage without a bare "verified" claim', () => {
    expect(bandDescriptor('L1').label).toBe('L1');
    expect(bandDescriptor('L3').blurb).toBe('Comprehensive source coverage');
    const all = ['L1', 'L2', 'L3', 'L0', undefined].map((b) => bandDescriptor(b).blurb.toLowerCase());
    for (const blurb of all) {
      expect(blurb).not.toBe('verified');
      expect(blurb).not.toContain('automatically verified');
    }
  });

  it('falls back to L0 for unknown bands', () => {
    expect(bandDescriptor(undefined).label).toBe('L0');
    expect(bandDescriptor('weird').label).toBe('L0');
  });
});

describe('pool — availability & readiness formatting', () => {
  it('reads absent or past availability as "Available now"', () => {
    expect(formatAvailability(undefined, NOW)).toBe('Available now');
    expect(formatAvailability('2026-06-01T00:00:00.000Z', NOW)).toBe('Available now');
    expect(formatAvailability('not-a-date', NOW)).toBe('Available now');
  });

  it('formats a future availability date', () => {
    expect(formatAvailability('2026-09-01T00:00:00.000Z', NOW)).toContain('Available');
    expect(formatAvailability('2026-09-01T00:00:00.000Z', NOW)).not.toBe('Available now');
  });

  it('labels readiness honestly, guarding non-numbers', () => {
    expect(readinessLabel(82)).toBe('Readiness 82/100');
    expect(readinessLabel(undefined)).toBe('Readiness pending');
    expect(readinessLabel(Number.NaN)).toBe('Readiness pending');
  });
});
