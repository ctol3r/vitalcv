import { describe, expect, it } from '@jest/globals';
import { SafetyThresholdRegistry } from '../rules/thresholds.js';

const makeSignal = (overrides: Partial<Record<string, any>> = {}) => ({
  clinicianId: 'clinician-1',
  privilegeCodes: ['ANES'],
  signalType: 'QUALITY_RISK' as const,
  severity: 'HIGH' as const,
  summary: 'test',
  source: 'unit-test',
  detectedAt: overrides.detectedAt ?? new Date(),
  ...overrides,
});

describe('SafetyThresholdRegistry', () => {
  it('flags repeated high severity signals', () => {
    const registry = new SafetyThresholdRegistry();
    const now = new Date();
    const earlier = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const decisions = registry.evaluate([makeSignal({ detectedAt: earlier }), makeSignal()], now);
    expect(decisions.find((decision) => decision.rule.id === 'high-repeat')).toBeDefined();
  });

  it('respects absence of signals', () => {
    const registry = new SafetyThresholdRegistry();
    expect(registry.evaluate([])).toEqual([]);
  });
});

