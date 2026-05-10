import { describe, expect, it } from 'vitest';
import { TEMPLATE_CHAOS_MODES } from '../types';
import { runDeploymentChaos } from '../index';

describe('W2-PR80A deployment chaos simulations', () => {
  it('all chaos modes return SAFE verdicts (fail-closed contract holds)', () => {
    const result = runDeploymentChaos();
    const unsafe = result.verdicts.filter((v) => v.verdict === 'UNSAFE');
    expect(unsafe).toEqual([]);
    expect(result.allSafe).toBe(true);
  });

  it('every declared chaos mode is exercised', () => {
    const result = runDeploymentChaos();
    const exercisedModes = new Set(result.verdicts.map((v) => v.mode));
    for (const mode of TEMPLATE_CHAOS_MODES) {
      expect(exercisedModes.has(mode)).toBe(true);
    }
  });

  it('chaos fingerprint is deterministic across runs', () => {
    const a = runDeploymentChaos();
    const b = runDeploymentChaos();
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('every verdict carries a non-empty rationale', () => {
    const result = runDeploymentChaos();
    for (const v of result.verdicts) {
      expect(v.rationale.length).toBeGreaterThan(5);
    }
  });

  it('verdict objects are frozen (immutable)', () => {
    const result = runDeploymentChaos();
    for (const v of result.verdicts) {
      expect(Object.isFrozen(v)).toBe(true);
    }
  });
});
