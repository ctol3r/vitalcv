import { buildOutcomeMemory, __testing__ } from '../outcomeMemory';
import { OutcomeResult, type DecisionOutcome } from '../decisionOutcome';

function makeOutcome(overrides: Partial<DecisionOutcome> = {}): DecisionOutcome {
  return {
    npi: '1346053246',
    orgId: 'org-alpha',
    decisionState: 'READY_CONFIDENT',
    actionTaken: 'PROCEED',
    outcome: OutcomeResult.STARTED,
    timeToStartMs: 4 * 24 * 60 * 60 * 1000,
    timestamp: '2026-04-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildOutcomeMemory', () => {
  test('excludes pending outcomes from learning patterns', () => {
    const memory = buildOutcomeMemory('1346053246', [
      makeOutcome({ outcome: OutcomeResult.PENDING, timeToStartMs: null }),
      makeOutcome({ outcome: OutcomeResult.STARTED, timeToStartMs: 2 * 24 * 60 * 60 * 1000 }),
      makeOutcome({ outcome: OutcomeResult.FAILED, actionTaken: 'REQUEST_DATA', timeToStartMs: null }),
    ]);

    expect(memory.history).toHaveLength(2);
    expect(memory.patterns.totalDecisions).toBe(2);
    expect(memory.patterns.successRate).toBe(0.5);
    expect(memory.patterns.failureRate).toBe(0.5);
    expect(memory.patterns.averageTimeToStartMs).toBe(2 * 24 * 60 * 60 * 1000);
    expect(memory.patterns.knownFailureTriggers).toContain('Missing Info Request Loops');
  });

  test('scopes history to the requested organization only', () => {
    const memory = buildOutcomeMemory('1346053246', [
      makeOutcome({ orgId: 'org-alpha', outcome: OutcomeResult.STARTED }),
      makeOutcome({ orgId: 'org-alpha', outcome: OutcomeResult.DELAYED, actionTaken: 'ESCALATE', timeToStartMs: null }),
      makeOutcome({ orgId: 'org-beta', outcome: OutcomeResult.FAILED, actionTaken: 'REQUEST_DATA', timeToStartMs: null }),
    ], 'org-alpha');

    expect(memory.orgId).toBe('org-alpha');
    expect(memory.history).toHaveLength(2);
    expect(memory.patterns.totalDecisions).toBe(2);
    expect(memory.patterns.failureRate).toBe(0.5);
    expect(memory.patterns.knownFailureTriggers).toContain('High-Friction Manual Review');
    expect(memory.patterns.knownFailureTriggers).not.toContain('Missing Info Request Loops');
  });
});

describe('isResolvedOutcome', () => {
  test('treats pending outcomes as unresolved', () => {
    expect(__testing__.isResolvedOutcome(makeOutcome({ outcome: OutcomeResult.PENDING }))).toBe(false);
    expect(__testing__.isResolvedOutcome(makeOutcome({ outcome: OutcomeResult.STARTED }))).toBe(true);
  });
});
