import { describe, expect, it } from 'vitest';
import {
  deriveIntelligenceNavKey,
  resolveIntelligenceView,
} from '../lib/intelligence/routes';
import { resolveOperationsNavKey } from '../components/intelligence-ops/shell';

describe('intelligence routes', () => {
  it('keeps /graph as a first-class nav destination', () => {
    expect(deriveIntelligenceNavKey('/graph')).toBe('graph');
    expect(deriveIntelligenceNavKey('/graph?npi=1234567890')).toBe('graph');
  });

  it('does not treat graph as an intelligence view', () => {
    expect(resolveIntelligenceView('graph')).toBe('dashboard');
  });
});

describe('operations shell nav override', () => {
  it('normalizes dashboard nav to graph on /graph routes', () => {
    expect(resolveOperationsNavKey('/graph', 'dashboard')).toBe('graph');
    expect(resolveOperationsNavKey('/graph')).toBe('graph');
  });

  it('preserves explicit non-graph nav choices', () => {
    expect(resolveOperationsNavKey('/graph', 'investigations')).toBe('investigations');
    expect(resolveOperationsNavKey('/intelligence', 'dashboard')).toBe('dashboard');
  });
});
