/**
 * ncqaValidationGate scale gate (W2-PR40A)
 *
 * Asserts the in-process NCQA validation gate passes on a clean codebase.
 * If this test fails, CI must fail — the gate is the contract that the
 * regulatory-export modules uphold their NCQA semantics.
 */
import { runNcqaValidationGate } from '../../ncqaValidationGate';

describe('ncqaValidationGate scale gate', () => {
  it('passes every gate check on the current codebase', () => {
    const verdict = runNcqaValidationGate();

    if (!verdict.ok) {
      const failures = verdict.checks
        .filter((c) => !c.passed)
        .map((c) => `  - ${c.id}: ${c.detail}`)
        .join('\n');
      throw new Error(
        `NCQA validation gate failed (${verdict.failed}/${verdict.passed + verdict.failed}):\n${failures}`,
      );
    }

    expect(verdict.ok).toBe(true);
    expect(verdict.failed).toBe(0);
    expect(verdict.passed).toBeGreaterThanOrEqual(7);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] ncqa-validation-gate passed=${verdict.passed} failed=${verdict.failed}`,
    );
  });

  it('reports each individual check with a passed flag and detail', () => {
    const verdict = runNcqaValidationGate();
    expect(Array.isArray(verdict.checks)).toBe(true);
    expect(verdict.checks.length).toBeGreaterThanOrEqual(7);
    for (const check of verdict.checks) {
      expect(typeof check.id).toBe('string');
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.detail).toBe('string');
      expect(check.detail.length).toBeGreaterThan(0);
    }
  });
});
